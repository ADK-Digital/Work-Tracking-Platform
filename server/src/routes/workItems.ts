import { ActivityEventType, Prisma, WorkItemType } from '@prisma/client';
import { Router } from 'express';
import { deflateRawSync } from 'zlib';
import { getUserRole, requireRole } from '../authorization';
import { prisma } from '../db';
import { listGroupMembers } from '../googleDirectory';
import { resolveOwnerDirectoryGroup } from '../ownerDirectoryGroup';

const workItemsRouter = Router();

const allowedTypes = new Set<string>(Object.values(WorkItemType));

const MAX_COMMENT_LENGTH = 5000;

const parseIncludeDeleted = (value: unknown): boolean => value === 'true';


const DEFAULT_STATUS_BY_TYPE: Record<WorkItemType, string> = {
  [WorkItemType.purchase_request]: 'submitted',
  [WorkItemType.task]: 'submitted',
};

const resolveAllowedStatus = async (type: WorkItemType, statusKey: string) => {
  return prisma.workItemStatus.findFirst({ where: { workType: type, statusKey, isActive: true } });
};

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
  const members = await listGroupMembers(resolveOwnerDirectoryGroup());
  if (members === null || members.length === 0) {
    return true;
  }

  return members.some((member) => member.googleId === owner.ownerGoogleId && member.email === owner.ownerEmail.toLowerCase());
};


const normalizeProjectName = (value: unknown): string | null | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const parseLimit = (value: unknown): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 50;
  }

  return Math.min(200, Math.floor(parsed));
};

const csvEscape = (value: string | number | boolean | null): string => {
  const stringValue = value === null ? '' : String(value);
  if (!/[",\n]/.test(stringValue)) {
    return stringValue;
  }

  return `"${stringValue.replace(/"/g, '""')}"`;
};

const toCsv = (rows: Array<Record<string, string | number | boolean | null>>): string => {
  if (rows.length === 0) {
    return '';
  }

  const headers = Object.keys(rows[0]);
  const lines = [headers.map((header) => csvEscape(header)).join(',')];

  for (const row of rows) {
    lines.push(headers.map((header) => csvEscape(row[header] ?? null)).join(','));
  }

  return lines.join('\n');
};

const xmlEscape = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const DOS_EPOCH_DATE = 0;
const DOS_EPOCH_TIME = 0;

const crc32Table = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let current = i;
    for (let bit = 0; bit < 8; bit += 1) {
      current = (current & 1) ? (0xedb88320 ^ (current >>> 1)) : (current >>> 1);
    }

    table[i] = current >>> 0;
  }

  return table;
})();

const crc32 = (buffer: Buffer): number => {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = (crc >>> 8) ^ crc32Table[(crc ^ byte) & 0xff];
  }

  return (crc ^ 0xffffffff) >>> 0;
};

const createXlsxBuffer = (rows: Array<Record<string, string | number | boolean | null>>): Buffer => {
  const headers = Object.keys(rows[0] ?? {});
  const xmlRow = (values: string[]) =>
    `<row>${values
      .map((value) => `<c t="inlineStr"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`)
      .join('')}</row>`;

  const sheetRows = [xmlRow(headers)];
  for (const row of rows) {
    sheetRows.push(xmlRow(headers.map((header) => String(row[header] ?? ''))));
  }

  const files = [
    {
      path: '[Content_Types].xml',
      content:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        + '<Default Extension="xml" ContentType="application/xml"/>'
        + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
        + '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
        + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
        + '</Types>',
    },
    {
      path: '_rels/.rels',
      content:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
        + '</Relationships>',
    },
    {
      path: 'xl/workbook.xml',
      content:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        + '<sheets><sheet name="Work Items" sheetId="1" r:id="rId1"/></sheets>'
        + '</workbook>',
    },
    {
      path: 'xl/_rels/workbook.xml.rels',
      content:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
        + '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
        + '</Relationships>',
    },
    {
      path: 'xl/styles.xml',
      content:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        + '<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>'
        + '<fills count="1"><fill><patternFill patternType="none"/></fill></fills>'
        + '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
        + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
        + '<cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>'
        + '</styleSheet>',
    },
    {
      path: 'xl/worksheets/sheet1.xml',
      content:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        + `<sheetData>${sheetRows.join('')}</sheetData>`
        + '</worksheet>',
    },
  ];

  const localFileRecords: Buffer[] = [];
  const centralDirectoryRecords: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const fileName = Buffer.from(file.path, 'utf8');
    const uncompressed = Buffer.from(file.content, 'utf8');
    const compressed = deflateRawSync(uncompressed);
    const fileCrc = crc32(uncompressed);

    const localHeader = Buffer.alloc(30 + fileName.length);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(8, 8);
    localHeader.writeUInt16LE(DOS_EPOCH_TIME, 10);
    localHeader.writeUInt16LE(DOS_EPOCH_DATE, 12);
    localHeader.writeUInt32LE(fileCrc, 14);
    localHeader.writeUInt32LE(compressed.length, 18);
    localHeader.writeUInt32LE(uncompressed.length, 22);
    localHeader.writeUInt16LE(fileName.length, 26);
    localHeader.writeUInt16LE(0, 28);
    fileName.copy(localHeader, 30);

    const centralHeader = Buffer.alloc(46 + fileName.length);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(8, 10);
    centralHeader.writeUInt16LE(DOS_EPOCH_TIME, 12);
    centralHeader.writeUInt16LE(DOS_EPOCH_DATE, 14);
    centralHeader.writeUInt32LE(fileCrc, 16);
    centralHeader.writeUInt32LE(compressed.length, 20);
    centralHeader.writeUInt32LE(uncompressed.length, 24);
    centralHeader.writeUInt16LE(fileName.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    fileName.copy(centralHeader, 46);

    localFileRecords.push(localHeader, compressed);
    centralDirectoryRecords.push(centralHeader);
    offset += localHeader.length + compressed.length;
  }

  const centralDirectory = Buffer.concat(centralDirectoryRecords);
  const endOfCentralDirectory = Buffer.alloc(22);
  endOfCentralDirectory.writeUInt32LE(0x06054b50, 0);
  endOfCentralDirectory.writeUInt16LE(0, 4);
  endOfCentralDirectory.writeUInt16LE(0, 6);
  endOfCentralDirectory.writeUInt16LE(files.length, 8);
  endOfCentralDirectory.writeUInt16LE(files.length, 10);
  endOfCentralDirectory.writeUInt32LE(centralDirectory.length, 12);
  endOfCentralDirectory.writeUInt32LE(offset, 16);
  endOfCentralDirectory.writeUInt16LE(0, 20);

  return Buffer.concat([...localFileRecords, centralDirectory, endOfCentralDirectory]);
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
  statusMeta: { statusKey: string; label: string; sortOrder: number } | null;
  projectName: string | null;
  ownerGoogleId: string;
  ownerEmail: string;
  ownerName: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  createdBy: string | null;
  updatedBy: string | null;
  hasAttachments?: boolean;
}) => ({
  ...workItem,
  status: workItem.statusMeta?.statusKey ?? '',
  statusLabel: workItem.statusMeta?.label ?? '',
  statusSortOrder: workItem.statusMeta?.sortOrder ?? null,
});

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
    ...(includeDeleted ? {} : { deletedAt: null, statusMeta: { is: { statusKey: { not: 'completed' } } } }),
  };

  const items = await prisma.workItem.findMany({
    where,
    include: { statusMeta: { select: { statusKey: true, label: true, sortOrder: true } } },
    orderBy: [{ statusMeta: { sortOrder: 'asc' } }, { createdAt: 'desc' }],
  });

  const attachmentCounts = await prisma.attachment.groupBy({
    by: ['workItemId'],
    where: {
      workItemId: { in: items.map((item) => item.id) },
      deletedAt: null,
    },
    _count: { _all: true },
  });

  const attachmentCountsByWorkItemId = new Map(
    attachmentCounts.map((entry) => [entry.workItemId, entry._count._all]),
  );

  return res.json(
    items.map((item) =>
      serializeWorkItem({
        ...item,
        hasAttachments: (attachmentCountsByWorkItemId.get(item.id) ?? 0) > 0,
      }),
    ),
  );
});


workItemsRouter.get('/search', async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const type = typeof req.query.type === 'string' ? req.query.type : undefined;
  const status = typeof req.query.status === 'string' ? req.query.status.trim() : undefined;
  const ownerGoogleId = typeof req.query.ownerGoogleId === 'string' ? req.query.ownerGoogleId.trim() : undefined;
  const projectName = typeof req.query.projectName === 'string' ? req.query.projectName.trim() : undefined;
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

  const projectWhere: Prisma.WorkItemWhereInput | undefined =
    projectName === undefined
      ? undefined
      : projectName === 'none'
        ? {
            type: WorkItemType.task,
            OR: [{ projectName: null }, { projectName: '' }],
          }
        : {
            type: WorkItemType.task,
            projectName,
          };

  const workItemQueryClauses: Prisma.WorkItemWhereInput[] = [];
  if (hasQuery) {
    workItemQueryClauses.push(
      { title: { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
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
    ...(status ? { statusMeta: { is: { statusKey: status } } } : {}),
    ...(ownerGoogleId ? { ownerGoogleId } : {}),
    ...(includeDeleted ? {} : { deletedAt: null }),
    ...(projectWhere ? { AND: [projectWhere] } : {}),
    ...(hasQuery ? { OR: workItemQueryClauses } : {}),
  };

  const workItems = await prisma.workItem.findMany({
    where: workItemWhere,
    include: { statusMeta: { select: { statusKey: true, label: true, sortOrder: true } } },
    orderBy: [{ statusMeta: { sortOrder: 'asc' } }, { updatedAt: 'desc' }],
    take: limit,
  });

  const workItemIds = workItems.map((item) => item.id);

  const comments = hasQuery
    ? await prisma.comment.findMany({
        where: {
          ...(includeDeleted ? {} : { deletedAt: null }),
          workItem: {
            ...(type ? { type: type as WorkItemType } : {}),
            ...(status ? { statusMeta: { is: { statusKey: status } } } : {}),
            ...(ownerGoogleId ? { ownerGoogleId } : {}),
            ...(includeDeleted ? {} : { deletedAt: null }),
            ...(projectWhere ? { AND: [projectWhere] } : {}),
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
            ...(status ? { statusMeta: { is: { statusKey: status } } } : {}),
            ...(ownerGoogleId ? { ownerGoogleId } : {}),
            ...(includeDeleted ? {} : { deletedAt: null }),
            ...(projectWhere ? { AND: [projectWhere] } : {}),
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
            ...(status ? { statusMeta: { is: { statusKey: status } } } : {}),
            ...(ownerGoogleId ? { ownerGoogleId } : {}),
            ...(includeDeleted ? {} : { deletedAt: null }),
            ...(projectWhere ? { AND: [projectWhere] } : {}),
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
    if (item.statusMeta?.statusKey.toLowerCase().includes(normalizedQ) || item.statusMeta?.label.toLowerCase().includes(normalizedQ)) matchedFields.push('status');
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
  const item = await prisma.workItem.findUnique({ where: { id: workItemId }, include: { statusMeta: { select: { statusKey: true, label: true, sortOrder: true } } } });

  if (!item || (item.deletedAt && req.authz?.role !== 'admin')) {
    return res.status(404).json({ error: 'Work item not found.' });
  }

  return res.json(serializeWorkItem(item));
});

workItemsRouter.post('/work-items', requireRole('admin'), async (req, res) => {
  const actor = req.user!.email;
  const { type, title, description, status, projectName } = req.body as {
    type?: string;
    title?: string;
    description?: string | null;
    status?: string;
    projectName?: string | null;
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

  const requestedStatus = (status && status.trim()) || DEFAULT_STATUS_BY_TYPE[type as WorkItemType];
  const allowedStatus = await resolveAllowedStatus(type as WorkItemType, requestedStatus);
  if (!allowedStatus) {
    return res.status(400).json({ error: 'Invalid status for type.' });
  }

  if (projectName !== undefined && projectName !== null && typeof projectName !== 'string') {
    return res.status(400).json({ error: 'Project name must be a string when provided.' });
  }

  const normalizedProjectName = normalizeProjectName(projectName);

  const item = await prisma.workItem.create({
    include: { statusMeta: { select: { statusKey: true, label: true, sortOrder: true } } },
    data: {
      type: type as WorkItemType,
      title: title.trim(),
      description: description ?? null,
      statusMeta: { connect: { id: allowedStatus.id } },
      projectName: type === WorkItemType.task ? (normalizedProjectName ?? null) : null,
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
  const existing = await prisma.workItem.findUnique({ where: { id: workItemId }, include: { statusMeta: true } });

  if (!existing) {
    return res.status(404).json({ error: 'Work item not found.' });
  }

  const { type, title, description, status, projectName } = req.body as {
    type?: string;
    title?: string;
    description?: string | null;
    status?: string;
    projectName?: string | null;
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

  const nextTypeForStatus = (type as WorkItemType | undefined) ?? existing.type;
  const nextStatusKey = status !== undefined ? status.trim() : existing.statusMeta?.statusKey ?? DEFAULT_STATUS_BY_TYPE[nextTypeForStatus];
  const nextStatus = await resolveAllowedStatus(nextTypeForStatus, nextStatusKey);
  if (!nextStatus) {
    return res.status(400).json({ error: 'Invalid status for type.' });
  }

  if (projectName !== undefined && projectName !== null && typeof projectName !== 'string') {
    return res.status(400).json({ error: 'Project name must be a string when provided.' });
  }

  const normalizedPatchProjectName = normalizeProjectName(projectName);
  const nextType = (type as WorkItemType | undefined) ?? existing.type;

  const data: Prisma.WorkItemUpdateInput = {
    ...(type !== undefined ? { type: type as WorkItemType } : {}),
    ...(title !== undefined ? { title: title.trim() } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(status !== undefined ? { statusMeta: { connect: { id: nextStatus.id } } } : {}),
    ...(projectName !== undefined || (type !== undefined && (type as WorkItemType) === WorkItemType.purchase_request)
      ? { projectName: nextType === WorkItemType.task ? (normalizedPatchProjectName ?? null) : null }
      : {}),
    ...(ownerParsed.value ? ownerParsed.value : {}),
  };

  if (type !== undefined && status === undefined) {
    data.statusMeta = { connect: { id: nextStatus.id } };
  }

  if (Object.keys(data).length > 0) {
    data.updatedBy = actor;
  }

  const events: { type: ActivityEventType; message: string }[] = [];

  if (status !== undefined && status.trim() !== (existing.statusMeta?.statusKey ?? '')) {
    events.push({
      type: ActivityEventType.status_changed,
      message: `Status changed: ${existing.statusMeta?.statusKey ?? 'unknown'} -> ${status.trim()}`,
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
    const next = await tx.workItem.update({
      where: { id: workItemId },
      include: { statusMeta: { select: { statusKey: true, label: true, sortOrder: true } } },
      data,
    });

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


workItemsRouter.get('/work-item-statuses', async (req, res) => {
  const type = typeof req.query.type === 'string' ? req.query.type : undefined;
  if (type && !allowedTypes.has(type)) {
    return res.status(400).json({ error: 'Invalid type query parameter.' });
  }

  const statuses = await prisma.workItemStatus.findMany({
    where: {
      ...(type ? { workType: type as WorkItemType } : {}),
      isActive: true,
    },
    orderBy: [{ workType: 'asc' }, { sortOrder: 'asc' }],
  });

  return res.json(statuses);
});

workItemsRouter.post('/work-items/:id/complete', requireRole('admin'), async (req, res) => {
  const actor = req.user!.email;
  const workItemId = String(req.params.id);
  const existing = await prisma.workItem.findUnique({ where: { id: workItemId }, include: { statusMeta: true } });

  if (!existing) {
    return res.status(404).json({ error: 'Work item not found.' });
  }

  const completedStatus = await resolveAllowedStatus(existing.type, 'completed');
  if (!completedStatus) {
    return res.status(400).json({ error: 'Completed status is not configured for this type.' });
  }

  const completed = await prisma.$transaction(async (tx) => {
    const next = await tx.workItem.update({
      where: { id: workItemId },
      include: { statusMeta: { select: { statusKey: true, label: true, sortOrder: true } } },
      data: { statusMeta: { connect: { id: completedStatus.id } }, updatedBy: actor },
    });

    await tx.activityEvent.create({
      data: {
        workItemId,
        type: ActivityEventType.status_changed,
        message: `Status changed: ${existing.statusMeta?.statusKey ?? 'unknown'} -> completed`,
        actor,
      },
    });

    return next;
  });

  return res.json(serializeWorkItem(completed));
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
      include: { statusMeta: { select: { statusKey: true, label: true, sortOrder: true } } },
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
  const format = typeof req.query.format === 'string' ? req.query.format : 'json';
  const status = typeof req.query.status === 'string' ? req.query.status.trim() : undefined;
  const ownerGoogleId = typeof req.query.ownerGoogleId === 'string' ? req.query.ownerGoogleId.trim() : undefined;
  const projectName = typeof req.query.projectName === 'string' ? req.query.projectName.trim() : undefined;
  const includeDeleted = parseIncludeDeleted(req.query.includeDeleted);
  const isAdmin = req.authz?.role === 'admin';

  if (includeDeleted && !isAdmin) {
    return res.status(403).json({ error: 'Only admins may include deleted items.' });
  }

  if (type && (typeof type !== 'string' || !allowedTypes.has(type))) {
    return res.status(400).json({ error: 'Invalid type query parameter.' });
  }

  if (!['json', 'csv', 'xlsx'].includes(format)) {
    return res.status(400).json({ error: 'Invalid format query parameter.' });
  }

  const projectWhere: Prisma.WorkItemWhereInput | undefined =
    projectName === undefined
      ? undefined
      : projectName === 'none'
        ? {
            type: WorkItemType.task,
            OR: [{ projectName: null }, { projectName: '' }],
          }
        : {
            type: WorkItemType.task,
            projectName,
          };

  const workItems = await prisma.workItem.findMany({
    where: {
      ...(type ? { type: type as WorkItemType } : {}),
      ...(status ? { statusMeta: { is: { statusKey: status } } } : {}),
      ...(ownerGoogleId ? { ownerGoogleId } : {}),
      ...(projectWhere ? { AND: [projectWhere] } : {}),
      ...(includeDeleted ? {} : { deletedAt: null }),
    },
    include: { statusMeta: { select: { statusKey: true, label: true, sortOrder: true } } },
    orderBy: [{ statusMeta: { sortOrder: 'asc' } }, { createdAt: 'desc' }],
  });

  const serialized = workItems.map(serializeWorkItem);
  const rows = serialized.map((item) => ({
    id: item.id,
    type: item.type,
    title: item.title,
    status: item.status,
    statusLabel: item.statusLabel,
    owner: item.ownerName,
    ownerEmail: item.ownerEmail,
    requestor: item.createdBy ?? '',
    projectName: item.projectName ?? '',
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    deleted: Boolean(item.deletedAt),
    description: item.description ?? '',
  }));

  const dateStamp = new Date().toISOString().slice(0, 10);
  if (format === 'json') {
    res.setHeader('Content-Disposition', `attachment; filename="work-items-export-${dateStamp}.json"`);
    return res.json({ workItems: serialized });
  }

  const csv = toCsv(rows);
  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="work-items-export-${dateStamp}.csv"`);
    return res.send(csv);
  }

  const workbookBuffer = createXlsxBuffer(rows);

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="work-items-export-${dateStamp}.xlsx"`);
  return res.send(workbookBuffer);
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
