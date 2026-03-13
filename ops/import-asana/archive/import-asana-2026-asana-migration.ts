import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { ActivityEventType, PrismaClient, WorkItemType } = require('../../server/node_modules/@prisma/client');
const { listGroupMembers } = require('../../server/src/googleDirectory.ts') as typeof import('../../server/src/googleDirectory');
const { resolveOwnerDirectoryGroup } = require('../../server/src/ownerDirectoryGroup.ts') as typeof import('../../server/src/ownerDirectoryGroup');

type DirectoryPerson = import('../../server/src/googleDirectory').DirectoryPerson;

type CsvConfig = {
  fileName: string;
  sourceName: string;
  workItemType: WorkItemType;
  defaultProjectName: string | null;
};

type AsanaRow = Record<string, string>;

type ImportRecord = {
  sourceFile: string;
  workItem: {
    type: WorkItemType;
    title: string;
    description: string | null;
    status: string;
    ownerGoogleId: string;
    ownerEmail: string;
    ownerName: string;
    projectName: string | null;
  };
  activityEvent: {
    type: ActivityEventType;
    message: string;
    actor: string;
  };
};

type FileSummary = {
  totalRows: number;
  importedRows: number;
  skippedCompleted: number;
  skippedMissingOwnerEmail: number;
  skippedOwnerNotFound: number;
  skippedEmptyTitle: number;
};

const ASANA_IMPORT_DIR = '/home/stefan/asana-import';
const PURCHASE_REQUEST_OWNER_EMAIL = 'jlamora@bscsd.org';
const TASK_FALLBACK_OWNER_EMAIL = 'aperuzzi@bscsd.org';
const EXECUTE_FLAG = '--execute';

const CSV_CONFIGS: CsvConfig[] = [
  {
    fileName: 'Break_Project_List.csv',
    sourceName: 'Break Project List',
    workItemType: WorkItemType.task,
    defaultProjectName: 'Break Project List',
  },
  {
    fileName: 'Budgeting_&_Purchases.csv',
    sourceName: 'Budgeting & Purchases',
    workItemType: WorkItemType.purchase_request,
    defaultProjectName: null,
  },
  {
    fileName: 'Task_Tracking.csv',
    sourceName: 'Task Tracking',
    workItemType: WorkItemType.task,
    defaultProjectName: 'Task Tracking',
  },
  {
    fileName: 'Team_Coordination_&_Tasks.csv',
    sourceName: 'Team Coordination & Tasks',
    workItemType: WorkItemType.task,
    defaultProjectName: 'Team Coordination & Tasks',
  },
];

const DEFAULT_MOCK_OWNERS: DirectoryPerson[] = [
  { googleId: 'mock-owner-001', email: 'alex.kim@example.org', displayName: 'Alex Kim' },
  { googleId: 'mock-owner-002', email: 'morgan.lee@example.org', displayName: 'Morgan Lee' },
  { googleId: 'mock-owner-003', email: 'chris.nguyen@example.org', displayName: 'Chris Nguyen' },
  { googleId: 'mock-owner-004', email: 'avery.tran@example.org', displayName: 'Avery Tran' },
  { googleId: 'mock-owner-005', email: 'noah.diaz@example.org', displayName: 'Noah Diaz' },
  { googleId: 'mock-owner-006', email: 'kira.james@example.org', displayName: 'Kira James' },
];

const normalize = (value: string | undefined): string => (value ?? '').trim();

const appendMissingAssigneeNote = (description: string | null): string => {
  const note = 'Imported from Asana without an assignee.';
  if (!description) {
    return note;
  }

  return `${description}\n\n${note}`;
};

const buildPurchaseDescription = (row: AsanaRow): string | null => {
  const parts: string[] = [];

  const notes = normalize(row['Notes']);
  const purpose = normalize(row['Purpose']);
  const linksAndAttachments = normalize(row['Links & Attachments']);

  if (notes) {
    parts.push(`Notes:\n${notes}`);
  }

  if (purpose) {
    parts.push(`Purpose:\n${purpose}`);
  }

  if (linksAndAttachments) {
    parts.push(`Links & Attachments:\n${linksAndAttachments}`);
  }

  if (parts.length === 0) {
    return null;
  }

  return parts.join('\n\n');
};

const parseEnvFile = async (envFilePath: string): Promise<boolean> => {
  try {
    const raw = await fs.readFile(envFilePath, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      const eqIndex = trimmed.indexOf('=');
      if (eqIndex <= 0) {
        continue;
      }

      const key = trimmed.slice(0, eqIndex).trim();
      let value = trimmed.slice(eqIndex + 1).trim();

      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      if (!process.env[key]) {
        process.env[key] = value;
      }
    }

    return true;
  } catch {
    return false;
  }
};

const loadRuntimeEnv = async (): Promise<string[]> => {
  const checkedPaths = [
    '/home/stefan/pm-prod/secrets/server.env.prod',
    '/home/stefan/pm-prod/secrets/server.env.prod.runtime',
    '/home/stefan/pm-prod/ADK-Digital-Site/server/.env.prod',
    path.resolve(process.cwd(), 'server/.env.prod'),
    path.resolve(process.cwd(), '.env.backend'),
    path.resolve(process.cwd(), 'server/.env'),
  ];

  const loadedPaths: string[] = [];

  for (const envPath of checkedPaths) {
    const loaded = await parseEnvFile(envPath);
    if (loaded) {
      loadedPaths.push(envPath);
    }
  }

  return loadedPaths;
};

const parseCsvContent = (content: string): AsanaRow[] => {
  const rows: string[][] = [];
  let currentCell = '';
  let currentRow: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];

    if (char === '"') {
      const nextChar = content[i + 1];
      if (inQuotes && nextChar === '"') {
        currentCell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      currentRow.push(currentCell);
      currentCell = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && content[i + 1] === '\n') {
        i += 1;
      }

      currentRow.push(currentCell);
      currentCell = '';

      if (currentRow.some((cell) => cell.length > 0)) {
        rows.push(currentRow);
      }

      currentRow = [];
      continue;
    }

    currentCell += char;
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell);
    if (currentRow.some((cell) => cell.length > 0)) {
      rows.push(currentRow);
    }
  }

  if (rows.length === 0) {
    return [];
  }

  const headers = rows[0].map((header) => header.trim());
  return rows.slice(1).map((cells) => {
    const record: AsanaRow = {};
    for (let i = 0; i < headers.length; i += 1) {
      record[headers[i]] = cells[i] ?? '';
    }
    return record;
  });
};

const parseMockOwners = (): DirectoryPerson[] => {
  const raw = process.env.OWNER_DIRECTORY_MOCK_JSON?.trim();
  if (!raw) {
    return DEFAULT_MOCK_OWNERS;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((item): item is DirectoryPerson => Boolean(item?.googleId && item?.email && item?.displayName))
      .map((item) => ({
        googleId: item.googleId,
        email: item.email.toLowerCase(),
        displayName: item.displayName,
      }));
  } catch {
    return [];
  }
};

const resolveOwners = async (): Promise<{ owners: DirectoryPerson[]; source: string; groupEmail: string }> => {
  const groupEmail = resolveOwnerDirectoryGroup();
  const groupMembers = await listGroupMembers(groupEmail);

  if (groupMembers === null) {
    return {
      owners: parseMockOwners(),
      source: 'mock',
      groupEmail,
    };
  }

  return {
    owners: groupMembers,
    source: 'google-directory',
    groupEmail,
  };
};

const main = async () => {
  const shouldExecute = process.argv.includes(EXECUTE_FLAG);
  const loadedEnvPaths = await loadRuntimeEnv();

  const prisma = new PrismaClient();

  try {
    const ownerResolution = await resolveOwners();
    const ownerByEmail = new Map(ownerResolution.owners.map((owner) => [owner.email.toLowerCase(), owner]));

    let existingProjectOptionSet = new Set<string>();
    try {
      const existingProjectOptions = await prisma.$queryRaw<Array<{ name: string }>>`SELECT name FROM "TaskProjectOption"`;
      existingProjectOptionSet = new Set(existingProjectOptions.map((item) => item.name));
    } catch (error) {
      console.warn('WARNING: Could not query TaskProjectOption. Project option existence checks will assume no existing values.');
      console.warn(error);
    }

    const importRecords: ImportRecord[] = [];
    const fileSummaries = new Map<string, FileSummary>();
    const skippedRows: string[] = [];
    const mappedOwners = new Set<string>();
    const projectOptionsToCreate = new Set<string>();

    for (const config of CSV_CONFIGS) {
      const filePath = path.join(ASANA_IMPORT_DIR, config.fileName);
      const rawCsv = await fs.readFile(filePath, 'utf8');
      const rows = parseCsvContent(rawCsv);

      const summary: FileSummary = {
        totalRows: rows.length,
        importedRows: 0,
        skippedCompleted: 0,
        skippedMissingOwnerEmail: 0,
        skippedOwnerNotFound: 0,
        skippedEmptyTitle: 0,
      };

      for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
        const row = rows[rowIndex];
        const completedAt = normalize(row['Completed At']);
        if (completedAt) {
          summary.skippedCompleted += 1;
          continue;
        }

        const title = normalize(row['Name']);
        if (!title) {
          summary.skippedEmptyTitle += 1;
          skippedRows.push(`${config.fileName}#${rowIndex + 2}: missing Name/title`);
          continue;
        }

        let ownerEmail = '';
        let usedTaskFallbackOwner = false;
        if (config.workItemType === WorkItemType.purchase_request) {
          ownerEmail = PURCHASE_REQUEST_OWNER_EMAIL;
        } else {
          ownerEmail = normalize(row['Assignee Email']).toLowerCase();
          if (!ownerEmail) {
            ownerEmail = TASK_FALLBACK_OWNER_EMAIL;
            usedTaskFallbackOwner = true;
          }
        }

        const owner = ownerByEmail.get(ownerEmail);
        if (!owner) {
          summary.skippedOwnerNotFound += 1;
          skippedRows.push(`${config.fileName}#${rowIndex + 2}: owner not found for email ${ownerEmail}`);
          continue;
        }

        const ownerName =
          config.workItemType === WorkItemType.purchase_request || usedTaskFallbackOwner
            ? owner.displayName
            : normalize(row['Assignee']) || owner.displayName;
        const projectName = config.workItemType === WorkItemType.task ? config.defaultProjectName : null;

        if (projectName && !existingProjectOptionSet.has(projectName)) {
          projectOptionsToCreate.add(projectName);
        }

        importRecords.push({
          sourceFile: config.fileName,
          workItem: {
            type: config.workItemType,
            title,
            description:
              config.workItemType === WorkItemType.purchase_request
                ? buildPurchaseDescription(row)
                : usedTaskFallbackOwner
                  ? appendMissingAssigneeNote(normalize(row['Notes']) || null)
                  : normalize(row['Notes']) || null,
            status:
              config.workItemType === WorkItemType.purchase_request
                ? normalize(row['Status']) || normalize(row['Section/Column']) || 'Imported'
                : normalize(row['Section/Column']) || 'Imported',
            ownerGoogleId: owner.googleId,
            ownerEmail: owner.email,
            ownerName,
            projectName,
          },
          activityEvent: {
            type: ActivityEventType.created,
            message: 'Imported from Asana',
            actor: 'asana-import',
          },
        });

        mappedOwners.add(`${owner.displayName} <${owner.email}>`);
        summary.importedRows += 1;
      }

      fileSummaries.set(config.fileName, summary);
    }

    console.log('=== Asana Import Summary ===');
    console.log(`CSV directory: ${ASANA_IMPORT_DIR}`);
    console.log(`Owner source: ${ownerResolution.source} (${ownerResolution.groupEmail})`);
    console.log(`About to import ${importRecords.length} records${shouldExecute ? ' (execute mode)' : ' (dry-run mode)'}`);
    console.log(`Env files loaded: ${loadedEnvPaths.length > 0 ? loadedEnvPaths.join(', ') : 'none (using existing process env only)'}`);

    console.log('\nPer-CSV counts:');
    for (const config of CSV_CONFIGS) {
      const summary = fileSummaries.get(config.fileName);
      if (!summary) {
        continue;
      }

      console.log(
        `- ${config.fileName}: total=${summary.totalRows}, import=${summary.importedRows}, skippedCompleted=${summary.skippedCompleted}, skippedMissingOwnerEmail=${summary.skippedMissingOwnerEmail}, skippedOwnerNotFound=${summary.skippedOwnerNotFound}, skippedEmptyTitle=${summary.skippedEmptyTitle}`,
      );
    }

    console.log('\nTask project options that would be created:');
    if (projectOptionsToCreate.size === 0) {
      console.log('- none');
    } else {
      for (const projectName of [...projectOptionsToCreate].sort()) {
        console.log(`- ${projectName}`);
      }
    }

    console.log('\nOwners mapped:');
    if (mappedOwners.size === 0) {
      console.log('- none');
    } else {
      for (const owner of [...mappedOwners].sort()) {
        console.log(`- ${owner}`);
      }
    }

    console.log('\nSkipped rows:');
    if (skippedRows.length === 0) {
      console.log('- none');
    } else {
      for (const warning of skippedRows) {
        console.warn(`- WARNING ${warning}`);
      }
    }

    if (shouldExecute) {
      if (projectOptionsToCreate.size > 0) {
        await prisma.$transaction(
          [...projectOptionsToCreate].sort().map((projectName) =>
            prisma.taskProjectOption.upsert({
              where: { name: projectName },
              update: {},
              create: { name: projectName },
            }),
          ),
        );
      }

      for (const record of importRecords) {
        await prisma.$transaction(async (tx) => {
          const createdWorkItem = await tx.workItem.create({
            data: {
              type: record.workItem.type,
              title: record.workItem.title,
              description: record.workItem.description,
              status: record.workItem.status,
              ownerGoogleId: record.workItem.ownerGoogleId,
              ownerEmail: record.workItem.ownerEmail,
              ownerName: record.workItem.ownerName,
              projectName: record.workItem.projectName,
            },
          });

          await tx.activityEvent.create({
            data: {
              workItemId: createdWorkItem.id,
              type: record.activityEvent.type,
              message: record.activityEvent.message,
              actor: record.activityEvent.actor,
            },
          });
        });
      }

      console.log(`\nImport completed. ${importRecords.length} records were written to the database.`);
    } else {
      console.log(`\nDry run only. Re-run with ${EXECUTE_FLAG} to write to the database.`);
    }
  } finally {
    await prisma.$disconnect();
  }
};

main().catch((error) => {
  console.error('Asana import dry run failed.');
  console.error(error);
  process.exitCode = 1;
});
