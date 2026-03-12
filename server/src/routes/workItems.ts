import { ActivityEventType, Prisma, WorkItemType } from '@prisma/client';
import { Router } from 'express';
import { getUserRole, requireRole } from '../authorization';
import { prisma } from '../db';
import { listGroupMembers } from '../googleDirectory';
import { resolveOwnerDirectoryGroup } from '../ownerDirectoryGroup';

const workItemsRouter = Router();

const allowedTypes = new Set<string>(Object.values(WorkItemType));

const MAX_COMMENT_LENGTH = 5000;

const parseIncludeDeleted = (value: unknown): boolean => value === 'true';

type OwnerFields = {
  ownerGoogleId: string;
  ownerEmail: string;
  ownerName: string;
};

const parseOwnerFields = (body: Record<string, unknown>, mode: 'create' | 'patch'):
  | { ok: true; value?: OwnerFields }
  | { ok: false; error: string } => {
  const ownerGoogleId = body.ownerGoogleId;
  const ownerEmail = body.ownerEmail;
  const ownerName = body.ownerName;

  const anyProvided = ownerGoogleId !== undefined || ownerEmail !== undefined || ownerName !== undefined;

  if (mode === 'create' && !anyProvided) {
    return { ok: false, error: 'Owner is required.' };
  }

  if (mode === 'patch' && !anyProvided) {
    return { ok: true };
  }

  if (ownerGoogleId === undefined || ownerEmail === undefined || ownerName === undefined) {
    return { ok: false, error: 'Owner fields must be provided together.' };
  }

  if (typeof ownerGoogleId !== 'string' || typeof ownerEmail !== 'string' || typeof ownerName !== 'string') {
    return { ok: false, error: 'Owner fields must be strings.' };
  }

  const normalized = {
    ownerGoogleId: ownerGoogleId.trim(),
    ownerEmail: ownerEmail.trim().toLowerCase(),
    ownerName: ownerName.trim(),
  };

  if (!normalized.ownerGoogleId || !normalized.ownerEmail || !normalized.ownerName) {
    return { ok: false, error: 'Owner fields must be non-empty.' };
  }

  return { ok: true, value: normalized };
};

const ownerLabel = (owner: Pick<OwnerFields, 'ownerName' | 'ownerEmail'>): string => owner.ownerName || owner.ownerEmail;

const validateOwnerAgainstDirectory = async (owner: OwnerFields): Promise<boolean> => {
  const members = await listGroupMembers(process.env.OWNER_DIRECTORY_GROUP?.trim() || 'cms-admins');
  if (members === null || members.length === 0) {
    return true;
  }

  return members.some((member) => member.googleId === owner.ownerGoogleId && member.email === owner.ownerEmail.toLowerCase());
};

const parseLimit = (value: unknown): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 50;
  }

  return Math.min(200, Math.floor(parsed));
};

const isUuid = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const isDateOnly = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value);

const snippetFromText = (text: string, query: string): string | undefined => {
  if (!text) {
    return undefined;
  }

  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return text.slice(0, 160);
  }

  const index = text.toLowerCase().indexOf(normalized);
  if (index < 0) {
    return text.slice(0, 160);
  }

  const start = Math.max(0, index - 40);
  const end = Math.min(text.length, index + normalized.length + 80);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < text.length ? '…' : '';
  return `${prefix}${text.slice(start, end)}${suffix}`;
};

const serializeWorkItem = (workItem: {
  id: string;
  type: WorkItemType;
  title: string;
  description: string | null;
  status: string;
  ownerGoogleId: string;
  ownerEmail: string;
  ownerName: string;
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


workItemsRouter.get('/search', async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const type = typeof req.query.type === 'string' ? req.query.type : undefined;
  const status = typeof req.query.status === 'string' ? req.query.status.trim() : undefined;
  const ownerGoogleId = typeof req.query.ownerGoogleId === 'string' ? req.query.ownerGoogleId.trim() : undefined;
  const includeDeletedRequested = parseIncludeDeleted(req.query.includeDeleted);
  const includeDeleted = includeDeletedRequested && req.authz?.role === 'admin';
  const limit = parseLimit(req.query.limit);

  if (includeDeletedRequested && req.authz?.role !== 'admin') {
    return res.status(403).json({ error: 'Only admins may include deleted items.' });
  }

  if (type && !allowedTypes.has(type)) {
    return res.status(400).json({ error: 'Invalid type query parameter.' });
  }

  const normalizedQ = q.toLowerCase();
  const hasQuery = normalizedQ.length > 0;
  const uuidQuery = hasQuery && isUuid(normalizedQ) ? normalizedQ : null;
  const dateQuery = hasQuery && isDateOnly(normalizedQ) ? normalizedQ : null;

  const workItemQueryClauses: Prisma.WorkItemWhereInput[] = [];
  if (hasQuery) {
    workItemQueryClauses.push(
      { title: { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
      { status: { contains: q, mode: 'insensitive' } },
      { ownerName: { contains: q, mode: 'insensitive' } },
      { ownerEmail: { contains: q, mode: 'insensitive' } },
      { createdBy: { contains: q, mode: 'insensitive' } },
      { updatedBy: { contains: q, mode: 'insensitive' } },
    );

    if (q.toLowerCase() === 'task' || q.toLowerCase() === 'purchase_request') {
      workItemQueryClauses.push({ type: q.toLowerCase() as WorkItemType });
    }

    if (uuidQuery) {
      workItemQueryClauses.push({ id: uuidQuery });
    }

    if (dateQuery) {
      const start = new Date(`${dateQuery}T00:00:00.000Z`);
      const end = new Date(`${dateQuery}T23:59:59.999Z`);
      workItemQueryClauses.push({ createdAt: { gte: start, lte: end } });
    }
  }

  const workItemWhere: Prisma.WorkItemWhereInput = {
    ...(type ? { type: type as WorkItemType } : {}),
    ...(status ? { status } : {}),
    ...(ownerGoogleId ? { ownerGoogleId } : {}),
    ...(includeDeleted ? {} : { deletedAt: null }),
    ...(hasQuery ? { OR: workItemQueryClauses } : {}),
  };

  const workItems = await prisma.workItem.findMany({
    where: workItemWhere,
    orderBy: { updatedAt: 'desc' },
    take: limit,
  });

  const workItemIds = workItems.map((item) => item.id);

  const comments = hasQuery
    ? await prisma.comment.findMany({
        where: {
          ...(includeDeleted ? {} : { deletedAt: null }),
          workItem: {
            ...(type ? { type: type as WorkItemType } : {}),
            ...(status ? { status } : {}),
            ...(ownerGoogleId ? { ownerGoogleId } : {}),
            ...(includeDeleted ? {} : { deletedAt: null }),
          },
          OR: [
            { body: { contains: q, mode: 'insensitive' } },
            { authorEmail: { contains: q, mode: 'insensitive' } },
          ],
        },
        include: { workItem: { select: { id: true } } },
        orderBy: { createdAt: 'desc' },
        take: limit,
      })
    : [];

  const activities = hasQuery
    ? await prisma.activityEvent.findMany({
        where: {
          workItem: {
            ...(type ? { type: type as WorkItemType } : {}),
            ...(status ? { status } : {}),
            ...(ownerGoogleId ? { ownerGoogleId } : {}),
            ...(includeDeleted ? {} : { deletedAt: null }),
          },
          OR: [
            { message: { contains: q, mode: 'insensitive' } },
            { actor: { contains: q, mode: 'insensitive' } },
          ],
        },
        orderBy: { timestamp: 'desc' },
        take: limit,
      })
    : []

  const attachments = hasQuery
    ? await prisma.attachment.findMany({
        where: {
          ...(includeDeleted ? {} : { deletedAt: null }),
          filename: { contains: q, mode: 'insensitive' },
          workItem: {
            ...(type ? { type: type as WorkItemType } : {}),
            ...(status ? { status } : {}),
            ...(ownerGoogleId ? { ownerGoogleId } : {}),
            ...(includeDeleted ? {} : { deletedAt: null }),
          },
        },
        orderBy: { uploadedAt: 'desc' },
        take: limit,
      })
    : [];;

  const workItemResults = workItems.map((item) => {
    const matchedFields: string[] = [];
    if (!hasQuery || item.title.toLowerCase().includes(normalizedQ)) matchedFields.push('title');
    if (item.description?.toLowerCase().includes(normalizedQ)) matchedFields.push('description');
    if (item.status.toLowerCase().includes(normalizedQ)) matchedFields.push('status');
    if (item.ownerName.toLowerCase().includes(normalizedQ) || item.ownerEmail.toLowerCase().includes(normalizedQ)) matchedFields.push('owner');
    if (item.createdBy?.toLowerCase().includes(normalizedQ)) matchedFields.push('createdBy');
    if (item.updatedBy?.toLowerCase().includes(normalizedQ)) matchedFields.push('updatedBy');
    if (item.type.toLowerCase().includes(normalizedQ)) matchedFields.push('type');
    if (uuidQuery && item.id === uuidQuery) matchedFields.push('id');
    if (dateQuery) {
      const day = item.createdAt.toISOString().slice(0, 10);
      if (day === dateQuery) matchedFields.push('createdAt');
    }

    return {
      kind: 'workItem' as const,
      workItem: serializeWorkItem(item),
      matchedFields: matchedFields.length > 0 ? matchedFields : ['title'],
      snippet: snippetFromText(`${item.title} ${item.description ?? ''}`.trim(), q),
      sortAt: item.updatedAt.getTime(),
    };
  });

  const commentResults = comments.map((comment) => {
    const matchedFields: string[] = [];
    if (comment.body.toLowerCase().includes(normalizedQ)) matchedFields.push('body');
    if (comment.authorEmail.toLowerCase().includes(normalizedQ)) matchedFields.push('authorEmail');

    return {
      kind: 'comment' as const,
      workItemId: comment.workItemId,
      comment: serializeComment(comment),
      matchedFields,
      snippet: snippetFromText(comment.body, q),
      sortAt: comment.createdAt.getTime(),
    };
  });

  const activityResults = activities.map((event) => {
    const matchedFields: string[] = [];
    if (event.message.toLowerCase().includes(normalizedQ)) matchedFields.push('message');
    if (event.actor?.toLowerCase().includes(normalizedQ)) matchedFields.push('actor');

    return {
      kind: 'activity' as const,
      workItemId: event.workItemId,
      activity: event,
      matchedFields,
      snippet: snippetFromText(event.message, q),
      sortAt: event.timestamp.getTime(),
    };
  });



  const attachmentResults = attachments.map((attachment) => ({
    kind: 'attachment' as const,
    workItemId: attachment.workItemId,
    attachment,
    matchedFields: ['filename'],
    snippet: snippetFromText(attachment.filename, q),
    sortAt: attachment.uploadedAt.getTime(),
  }));

  const results = [...workItemResults, ...commentResults, ...activityResults, ...attachmentResults]
    .sort((a, b) => b.sortAt - a.sortAt)
    .slice(0, limit)
    .map(({ sortAt: _sortAt, ...result }) => result);

  return res.json({
    results,
    meta: {
      includeDeleted,
      attachmentsMatched: attachmentResults.length,
      workItemIds,
    },
  });
});

workItemsRouter.get('/work-items/:id', async (req, res) => {
  const workItemId = String(req.params.id);
  const item = await prisma.workItem.findUnique({ where: { id: workItemId } });

  if (!item || (item.deletedAt && req.authz?.role !== 'admin')) {
    return res.status(404).json({ error: 'Work item not found.' });
  }

  return res.json(serializeWorkItem(item));
});

workItemsRouter.post('/work-items', requireRole('admin'), async (req, res) => {
  const actor = req.user!.email;
  const { type, title, description, status } = req.body as {
    type?: string;
    title?: string;
    description?: string | null;
    status?: string;
  };
  const ownerParsed = parseOwnerFields(req.body as Record<string, unknown>, 'create');
  if (!ownerParsed.ok) {
    return res.status(400).json({ error: ownerParsed.error });
  }

  if (!ownerParsed.value) {
    return res.status(400).json({ error: 'Owner is required.' });
  }

  if (!(await validateOwnerAgainstDirectory(ownerParsed.value))) {
    return res.status(400).json({ error: 'Selected owner is not in the owner directory.' });
  }

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
      ...ownerParsed.value,
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
  const workItemId = String(req.params.id);
  const existing = await prisma.workItem.findUnique({ where: { id: workItemId } });

  if (!existing) {
    return res.status(404).json({ error: 'Work item not found.' });
  }

  const { type, title, description, status } = req.body as {
    type?: string;
    title?: string;
    description?: string | null;
    status?: string;
  };
  const ownerParsed = parseOwnerFields(req.body as Record<string, unknown>, 'patch');
  if (!ownerParsed.ok) {
    return res.status(400).json({ error: ownerParsed.error });
  }

  if (ownerParsed.value && !(await validateOwnerAgainstDirectory(ownerParsed.value))) {
    return res.status(400).json({ error: 'Selected owner is not in the owner directory.' });
  }

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
    ...(ownerParsed.value ? ownerParsed.value : {}),
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

  if (ownerParsed.value && ownerParsed.value.ownerGoogleId !== existing.ownerGoogleId) {
    events.push({
      type: ActivityEventType.owner_changed,
      message: `Owner changed: ${ownerLabel(existing)} -> ${ownerLabel(ownerParsed.value)}`,
    });
  }

  if (events.length === 0 && Object.keys(data).length > 0) {
    events.push({
      type: ActivityEventType.updated,
      message: 'Work item updated',
    });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.workItem.update({ where: { id: workItemId }, data });

    if (events.length > 0) {
      await tx.activityEvent.createMany({
        data: events.map((event) => ({
          workItemId: workItemId,
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
  const workItemId = String(req.params.id);
  const existing = await prisma.workItem.findUnique({ where: { id: workItemId } });

  if (!existing) {
    return res.status(404).json({ error: 'Work item not found.' });
  }

  if (existing.deletedAt) {
    return res.status(409).json({ error: 'Work item already deleted.' });
  }

  await prisma.$transaction(async (tx) => {
    await tx.workItem.update({
      where: { id: workItemId },
      data: { deletedAt: new Date(), updatedBy: actor },
    });

    await tx.activityEvent.create({
      data: {
        workItemId: workItemId,
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
  const workItemId = String(req.params.id);
  const existing = await prisma.workItem.findUnique({ where: { id: workItemId } });

  if (!existing) {
    return res.status(404).json({ error: 'Work item not found.' });
  }

  if (!existing.deletedAt) {
    return res.status(409).json({ error: 'Work item is not deleted.' });
  }

  const restored = await prisma.$transaction(async (tx) => {
    const next = await tx.workItem.update({
      where: { id: workItemId },
      data: { deletedAt: null, updatedBy: actor },
    });

    await tx.activityEvent.create({
      data: {
        workItemId: workItemId,
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
  const workItemId = String(req.params.id);
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
        workItemId: workItemId,
        body,
        authorEmail: actor,
        authorName,
      },
    });

    await tx.activityEvent.create({
      data: {
        workItemId: workItemId,
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
  const commentId = String(req.params.commentId);
  const existing = await prisma.comment.findUnique({ where: { id: commentId } });

  if (!existing) {
    return res.status(404).json({ error: 'Comment not found.' });
  }

  if (existing.deletedAt) {
    return res.status(409).json({ error: 'Comment already deleted.' });
  }

  await prisma.$transaction(async (tx) => {
    await tx.comment.update({
      where: { id: commentId },
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
