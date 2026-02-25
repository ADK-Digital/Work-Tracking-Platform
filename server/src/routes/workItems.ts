import { ActivityEventType, Prisma, WorkItemType } from '@prisma/client';
import { Router } from 'express';
import { getUserRole, requireRole } from '../authorization';
import { prisma } from '../db';

const workItemsRouter = Router();

const allowedTypes = new Set<string>(Object.values(WorkItemType));

const MAX_COMMENT_LENGTH = 5000;

const parseIncludeDeleted = (value: unknown): boolean => value === 'true';

const serializeWorkItem = (workItem: {
  id: string;
  type: WorkItemType;
  title: string;
  description: string | null;
  status: string;
  owner: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  createdBy: string | null;
  updatedBy: string | null;
}) => workItem;

const serializeComment = (comment: {
  id: string;
  workItemId: string;
  body: string;
  authorEmail: string;
  authorName: string | null;
  createdAt: Date;
  deletedAt: Date | null;
  deletedBy: string | null;
}) => comment;


workItemsRouter.get('/work-items', async (req, res) => {
  const { type } = req.query;
  const includeDeleted = parseIncludeDeleted(req.query.includeDeleted);
  const isAdmin = req.authz?.role === 'admin';

  if (includeDeleted && !isAdmin) {
    return res.status(403).json({ error: 'Only admins may include deleted items.' });
  }

  if (type && (typeof type !== 'string' || !allowedTypes.has(type))) {
    return res.status(400).json({ error: 'Invalid type query parameter.' });
  }

  const where: Prisma.WorkItemWhereInput = {
    ...(type ? { type: type as WorkItemType } : {}),
    ...(includeDeleted ? {} : { deletedAt: null }),
  };

  const items = await prisma.workItem.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });

  return res.json(items.map(serializeWorkItem));
});

workItemsRouter.get('/work-items/:id', async (req, res) => {
  const item = await prisma.workItem.findUnique({ where: { id: req.params.id } });

  if (!item || (item.deletedAt && req.authz?.role !== 'admin')) {
    return res.status(404).json({ error: 'Work item not found.' });
  }

  return res.json(serializeWorkItem(item));
});

workItemsRouter.post('/work-items', requireRole('admin'), async (req, res) => {
  const actor = req.user!.email;
  const { type, title, description, status, owner } = req.body as {
    type?: string;
    title?: string;
    description?: string | null;
    status?: string;
    owner?: string | null;
  };

  if (!type || !allowedTypes.has(type)) {
    return res.status(400).json({ error: 'Invalid type. Must be task or purchase_request.' });
  }

  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Title is required.' });
  }

  if (!status || !status.trim()) {
    return res.status(400).json({ error: 'Status is required.' });
  }

  const item = await prisma.workItem.create({
    data: {
      type: type as WorkItemType,
      title: title.trim(),
      description: description ?? null,
      status: status.trim(),
      owner: owner ?? null,
      createdBy: actor,
      updatedBy: actor,
      activityEvents: {
        create: {
          type: ActivityEventType.created,
          message: 'Work item created',
          actor,
        },
      },
    },
  });

  return res.status(201).json(serializeWorkItem(item));
});

workItemsRouter.patch('/work-items/:id', requireRole('admin'), async (req, res) => {
  const actor = req.user!.email;
  const existing = await prisma.workItem.findUnique({ where: { id: req.params.id } });

  if (!existing) {
    return res.status(404).json({ error: 'Work item not found.' });
  }

  const { type, title, description, status, owner } = req.body as {
    type?: string;
    title?: string;
    description?: string | null;
    status?: string;
    owner?: string | null;
  };

  if (type !== undefined && !allowedTypes.has(type)) {
    return res.status(400).json({ error: 'Invalid type. Must be task or purchase_request.' });
  }

  if (title !== undefined && !title.trim()) {
    return res.status(400).json({ error: 'Title must be non-empty.' });
  }

  if (status !== undefined && !status.trim()) {
    return res.status(400).json({ error: 'Status must be non-empty.' });
  }

  const data: Prisma.WorkItemUpdateInput = {
    ...(type !== undefined ? { type: type as WorkItemType } : {}),
    ...(title !== undefined ? { title: title.trim() } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(status !== undefined ? { status: status.trim() } : {}),
    ...(owner !== undefined ? { owner } : {}),
  };

  if (Object.keys(data).length > 0) {
    data.updatedBy = actor;
  }

  const events: { type: ActivityEventType; message: string }[] = [];

  if (status !== undefined && status.trim() !== existing.status) {
    events.push({
      type: ActivityEventType.status_changed,
      message: `Status changed: ${existing.status} -> ${status.trim()}`,
    });
  }

  if (owner !== undefined && owner !== existing.owner) {
    events.push({
      type: ActivityEventType.owner_changed,
      message: `Owner changed: ${existing.owner ?? 'unassigned'} -> ${owner ?? 'unassigned'}`,
    });
  }

  if (events.length === 0 && Object.keys(data).length > 0) {
    events.push({
      type: ActivityEventType.updated,
      message: 'Work item updated',
    });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.workItem.update({ where: { id: req.params.id }, data });

    if (events.length > 0) {
      await tx.activityEvent.createMany({
        data: events.map((event) => ({
          workItemId: req.params.id,
          type: event.type,
          message: event.message,
          actor,
        })),
      });
    }

    return next;
  });

  return res.json(serializeWorkItem(updated));
});

workItemsRouter.delete('/work-items/:id', requireRole('admin'), async (req, res) => {
  const actor = req.user!.email;
  const existing = await prisma.workItem.findUnique({ where: { id: req.params.id } });

  if (!existing) {
    return res.status(404).json({ error: 'Work item not found.' });
  }

  if (existing.deletedAt) {
    return res.status(409).json({ error: 'Work item already deleted.' });
  }

  await prisma.$transaction(async (tx) => {
    await tx.workItem.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date(), updatedBy: actor },
    });

    await tx.activityEvent.create({
      data: {
        workItemId: req.params.id,
        type: ActivityEventType.deleted,
        message: 'Work item deleted',
        actor,
      },
    });
  });

  return res.status(204).send();
});


workItemsRouter.post('/work-items/:id/restore', requireRole('admin'), async (req, res) => {
  const actor = req.user!.email;
  const existing = await prisma.workItem.findUnique({ where: { id: req.params.id } });

  if (!existing) {
    return res.status(404).json({ error: 'Work item not found.' });
  }

  if (!existing.deletedAt) {
    return res.status(409).json({ error: 'Work item is not deleted.' });
  }

  const restored = await prisma.$transaction(async (tx) => {
    const next = await tx.workItem.update({
      where: { id: req.params.id },
      data: { deletedAt: null, updatedBy: actor },
    });

    await tx.activityEvent.create({
      data: {
        workItemId: req.params.id,
        type: ActivityEventType.restored,
        message: 'Work item restored',
        actor,
      },
    });

    return next;
  });

  return res.json(serializeWorkItem(restored));
});

workItemsRouter.get('/export/work-items', requireRole('admin'), async (req, res) => {
  const { type } = req.query;
  const includeDeleted = parseIncludeDeleted(req.query.includeDeleted);
  const isAdmin = req.authz?.role === 'admin';

  if (includeDeleted && !isAdmin) {
    return res.status(403).json({ error: 'Only admins may include deleted items.' });
  }

  if (type && (typeof type !== 'string' || !allowedTypes.has(type))) {
    return res.status(400).json({ error: 'Invalid type query parameter.' });
  }

  const workItems = await prisma.workItem.findMany({
    where: {
      ...(type ? { type: type as WorkItemType } : {}),
      ...(includeDeleted ? {} : { deletedAt: null }),
    },
    orderBy: { createdAt: 'desc' },
  });

  return res.json({ workItems: workItems.map(serializeWorkItem) });
});

workItemsRouter.get('/export/activity', requireRole('admin'), async (req, res) => {
  const workItemId = typeof req.query.workItemId === 'string' ? req.query.workItemId : undefined;

  const activityEvents = await prisma.activityEvent.findMany({
    where: workItemId ? { workItemId } : undefined,
    orderBy: { timestamp: 'desc' },
  });

  return res.json({ activityEvents });
});

workItemsRouter.get('/work-items/:id/activity', async (req, res) => {
  const item = await prisma.workItem.findUnique({ where: { id: req.params.id }, select: { id: true, deletedAt: true } });

  if (!item || (item.deletedAt && req.authz?.role !== 'admin')) {
    return res.status(404).json({ error: 'Work item not found.' });
  }

  const events = await prisma.activityEvent.findMany({
    where: { workItemId: req.params.id },
    orderBy: { timestamp: 'desc' },
  });

  return res.json(events);
});


workItemsRouter.get('/work-items/:id/comments', async (req, res) => {
  const item = await prisma.workItem.findUnique({ where: { id: req.params.id }, select: { id: true, deletedAt: true } });

  if (!item || (item.deletedAt && req.authz?.role !== 'admin')) {
    return res.status(404).json({ error: 'Work item not found.' });
  }

  const includeDeleted = parseIncludeDeleted(req.query.includeDeleted);
  const role = await getUserRole(req);
  const isAdmin = role === 'admin';

  if (includeDeleted && !isAdmin) {
    return res.status(403).json({ error: 'Only admins may include deleted comments.' });
  }

  const comments = await prisma.comment.findMany({
    where: {
      workItemId: req.params.id,
      ...(includeDeleted ? {} : { deletedAt: null }),
    },
    orderBy: { createdAt: 'asc' },
  });

  return res.json(comments.map(serializeComment));
});

workItemsRouter.post('/work-items/:id/comments', async (req, res) => {
  const actor = req.user!.email;
  const authorName = req.user!.name ?? null;
  const rawBody = typeof req.body?.body === 'string' ? req.body.body : '';
  const body = rawBody.trim();

  if (!body) {
    return res.status(400).json({ error: 'Comment body is required.' });
  }

  if (body.length > MAX_COMMENT_LENGTH) {
    return res.status(400).json({ error: `Comment body must be ${MAX_COMMENT_LENGTH} characters or fewer.` });
  }

  const item = await prisma.workItem.findUnique({ where: { id: req.params.id } });

  if (!item || (item.deletedAt && req.authz?.role !== 'admin')) {
    return res.status(404).json({ error: 'Work item not found.' });
  }

  const comment = await prisma.$transaction(async (tx) => {
    const created = await tx.comment.create({
      data: {
        workItemId: req.params.id,
        body,
        authorEmail: actor,
        authorName,
      },
    });

    await tx.activityEvent.create({
      data: {
        workItemId: req.params.id,
        type: ActivityEventType.updated,
        message: 'Comment added',
        actor,
      },
    });

    return created;
  });

  return res.status(201).json(serializeComment(comment));
});

workItemsRouter.delete('/comments/:commentId', requireRole('admin'), async (req, res) => {
  const actor = req.user!.email;
  const existing = await prisma.comment.findUnique({ where: { id: req.params.commentId } });

  if (!existing) {
    return res.status(404).json({ error: 'Comment not found.' });
  }

  if (existing.deletedAt) {
    return res.status(409).json({ error: 'Comment already deleted.' });
  }

  await prisma.$transaction(async (tx) => {
    await tx.comment.update({
      where: { id: req.params.commentId },
      data: {
        deletedAt: new Date(),
        deletedBy: actor,
      },
    });

    await tx.activityEvent.create({
      data: {
        workItemId: existing.workItemId,
        type: ActivityEventType.updated,
        message: 'Comment deleted',
        actor,
      },
    });
  });

  return res.status(204).send();
});

export default workItemsRouter;
