import { randomUUID } from 'crypto';
import { ActivityEventType } from '@prisma/client';
import { Router } from 'express';
import { getUserRole, requireRole } from '../authorization';
import { prisma } from '../db';
import { deleteObject, getObjectStream, putObject } from '../storage/s3';

const attachmentsRouter = Router();

const MAX_ATTACHMENT_SIZE_BYTES = Number(process.env.ATTACHMENT_MAX_SIZE_BYTES ?? 25 * 1024 * 1024);
const allowedTypes = new Set(
  (process.env.ATTACHMENT_ALLOWED_TYPES ??
    'application/pdf,image/png,image/jpeg,image/gif,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean),
);

const sanitizeFilename = (filename: string): string =>
  filename
    .normalize('NFKC')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 200);

const parseIncludeDeleted = (value: unknown): boolean => value === 'true';

const serializeAttachment = (attachment: {
  id: string;
  workItemId: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  uploadedBy: string;
  uploadedAt: Date;
  deletedAt: Date | null;
  deletedBy: string | null;
}) => attachment;

const getMulter = (): any => {
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const req = eval('require');
  return req('multer');
};

const upload = (() => {
  const multer = getMulter();
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_ATTACHMENT_SIZE_BYTES, files: 1 },
  });
})();

attachmentsRouter.get('/work-items/:id/attachments', async (req, res) => {
  const item = await prisma.workItem.findUnique({ where: { id: req.params.id }, select: { id: true, deletedAt: true } });
  if (!item || (item.deletedAt && req.authz?.role !== 'admin')) {
    return res.status(404).json({ error: 'Work item not found.' });
  }

  const includeDeletedRequested = parseIncludeDeleted(req.query.includeDeleted);
  const role = await getUserRole(req);
  const includeDeleted = includeDeletedRequested && role === 'admin';

  if (includeDeletedRequested && role !== 'admin') {
    return res.status(403).json({ error: 'Only admins may include deleted attachments.' });
  }

  const attachments = await prisma.attachment.findMany({
    where: {
      workItemId: req.params.id,
      ...(includeDeleted ? {} : { deletedAt: null }),
    },
    orderBy: { uploadedAt: 'desc' },
  });

  return res.json(attachments.map(serializeAttachment));
});

attachmentsRouter.post('/work-items/:id/attachments', upload.single('file'), async (req, res) => {
  const actor = req.user!.email;
  const item = await prisma.workItem.findUnique({ where: { id: req.params.id }, select: { id: true, deletedAt: true } });

  if (!item || (item.deletedAt && req.authz?.role !== 'admin')) {
    return res.status(404).json({ error: 'Work item not found.' });
  }

  const file = (req as any).file as {
    originalname: string;
    mimetype: string;
    size: number;
    buffer: Buffer;
  } | undefined;
  if (!file) {
    return res.status(400).json({ error: 'File is required.' });
  }

  if (!allowedTypes.has(file.mimetype.toLowerCase())) {
    return res.status(400).json({ error: 'File type is not allowed.' });
  }

  const safeFilename = sanitizeFilename(file.originalname || 'attachment');

  const attachment = await prisma.attachment.create({
    data: {
      workItemId: req.params.id,
      filename: safeFilename,
      contentType: file.mimetype,
      sizeBytes: file.size,
      storageKey: `pending/${randomUUID()}`,
      uploadedBy: actor,
    },
  });

  const storageKey = `work-items/${req.params.id}/${attachment.id}/${safeFilename}`;

  try {
    await putObject(storageKey, file.buffer, file.mimetype);
  } catch (error) {
    console.error('[attachments] upload failed', {
      workItemId: req.params.id,
      attachmentId: attachment.id,
      filename: safeFilename,
      contentType: file.mimetype,
      sizeBytes: file.size,
      error: error instanceof Error ? error.message : error,
    });
    await prisma.attachment.delete({ where: { id: attachment.id } });
    throw error;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const nextAttachment = await tx.attachment.update({
      where: { id: attachment.id },
      data: { storageKey },
    });

    await tx.activityEvent.create({
      data: {
        workItemId: req.params.id,
        type: ActivityEventType.attachment_added,
        message: `Attachment added: ${safeFilename}`,
        actor,
      },
    });

    return nextAttachment;
  });

  return res.status(201).json(serializeAttachment(updated));
});

attachmentsRouter.get('/attachments/:attachmentId/download', async (req, res) => {
  const attachment = await prisma.attachment.findUnique({ where: { id: req.params.attachmentId } });

  if (!attachment || attachment.deletedAt) {
    return res.status(404).json({ error: 'Attachment not found.' });
  }

  const item = await prisma.workItem.findUnique({ where: { id: attachment.workItemId }, select: { deletedAt: true } });
  if (!item || (item.deletedAt && req.authz?.role !== 'admin')) {
    return res.status(404).json({ error: 'Attachment not found.' });
  }

  const stream = await getObjectStream(attachment.storageKey);
  res.setHeader('Content-Type', attachment.contentType || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${attachment.filename.replace(/"/g, '')}"`);
  stream.on('error', (error) => {
    console.error('Attachment stream error', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to stream attachment.' });
    }
  });
  stream.pipe(res);
});

attachmentsRouter.delete('/attachments/:attachmentId', requireRole('admin'), async (req, res) => {
  const actor = req.user!.email;
  const attachmentId = String(req.params.attachmentId);
  const attachment = await prisma.attachment.findUnique({ where: { id: attachmentId } });
  if (!attachment) {
    return res.status(404).json({ error: 'Attachment not found.' });
  }

  if (attachment.deletedAt) {
    return res.status(409).json({ error: 'Attachment already deleted.' });
  }

  await prisma.$transaction(async (tx) => {
    await tx.attachment.update({
      where: { id: attachmentId },
      data: {
        deletedAt: new Date(),
        deletedBy: actor,
      },
    });

    await tx.activityEvent.create({
      data: {
        workItemId: attachment.workItemId,
        type: ActivityEventType.attachment_deleted,
        message: `Attachment deleted: ${attachment.filename}`,
        actor,
      },
    });
  });

  if ((process.env.ATTACHMENT_DELETE_OBJECT_ON_SOFT_DELETE ?? 'false') === 'true') {
    await deleteObject(attachment.storageKey);
  }

  return res.status(204).send();
});

export default attachmentsRouter;
