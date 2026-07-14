import { execFileSync } from 'node:child_process';
import { prisma } from '../../db';
import { listGroupMembers } from '../../googleDirectory';
import { resolveOwnerDirectoryGroup } from '../../ownerDirectoryGroup';
import { serializeActivity, serializeEmployees, serializeWorkItem } from './aggregators';
import { buildMetrics } from './metrics';
import { countUniqueOwners } from './ownerAggregator';
import { aggregateProjects } from './projectAggregator';
import { evaluateRisks } from './riskEvaluator';
import type { OrganizationState, OrganizationStateOptions, RawEmployee, RawOrganizationStateData } from './types';

const SCHEMA_VERSION = '1.0.0';
const DEFAULT_LIMITATIONS = [
  'No deadline model is available.',
  'No employee capacity model is available.',
  'Purchase request fields are not persisted beyond generic work-item fields.',
  'Project entity is derived from task grouping.',
  'Owner-directory availability depends on configured Google Directory access.',
];

const MODULE_APPLICATION_VERSION = process.env.APPLICATION_VERSION || process.env.npm_package_version || '1.0.0';
const MODULE_GIT_COMMIT = process.env.GIT_COMMIT || (() => {
  try { return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim() || null; } catch { return null; }
})();

const mockOwners = (): RawEmployee[] => {
  const raw = process.env.OWNER_DIRECTORY_MOCK_JSON?.trim();
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((item) => item?.googleId && item?.email).map((item) => ({ googleId: String(item.googleId), email: String(item.email).toLowerCase(), displayName: String(item.displayName ?? item.email) }));
      }
    } catch (error) {
      console.error('Failed to parse OWNER_DIRECTORY_MOCK_JSON', error);
    }
  }
  return [];
};

export const loadRawOrganizationStateData = async (): Promise<RawOrganizationStateData> => {
  const [workItems, recentActivity] = await Promise.all([
    prisma.workItem.findMany({ include: { statusMeta: { select: { statusKey: true, label: true, sortOrder: true } } }, orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }] }),
    prisma.activityEvent.findMany({ orderBy: [{ timestamp: 'desc' }, { id: 'asc' }], take: 50 }),
  ]);
  const groupEmail = resolveOwnerDirectoryGroup();
  const members = await listGroupMembers(groupEmail);
  return {
    workItems,
    recentActivity,
    employees: members ?? mockOwners(),
    ownerDirectory: { groupEmail, source: members === null ? 'mock' : 'google-directory', available: members !== null },
  };
};

export const buildOrganizationState = (rawData: RawOrganizationStateData, options: OrganizationStateOptions): OrganizationState => {
  const generatedAt = (options.now ?? new Date()).toISOString();
  const workItems = rawData.workItems.map(serializeWorkItem);
  const employees = serializeEmployees(rawData.employees);
  const projects = aggregateProjects(workItems);
  const ownerCount = countUniqueOwners(workItems);
  const namedProjectCount = projects.length;
  const base = {
    metadata: {
      schemaVersion: SCHEMA_VERSION,
      generatedAt,
      generatedBy: options.user.email,
      generatedByName: options.user.name,
      generatedByRole: options.role,
      applicationVersion: options.applicationVersion ?? MODULE_APPLICATION_VERSION,
      gitCommit: options.gitCommit ?? MODULE_GIT_COMMIT,
      snapshot: { type: 'organization-state' as const, scope: 'full' as const, generatedAt },
    },
    organization: { ownerDirectory: rawData.ownerDirectory },
    metrics: buildMetrics(workItems, ownerCount, namedProjectCount),
    employees,
    projects,
    workItems,
    tasks: { metrics: buildMetrics(workItems.filter((item) => item.type === 'task'), ownerCount, namedProjectCount), workItems: workItems.filter((item) => item.type === 'task') },
    purchaseRequests: { metrics: buildMetrics(workItems.filter((item) => item.type === 'purchase_request'), ownerCount, namedProjectCount), workItems: workItems.filter((item) => item.type === 'purchase_request') },
    recentActivity: serializeActivity(rawData.recentActivity),
  };
  const risks = evaluateRisks({ ...base, limitations: DEFAULT_LIMITATIONS });
  return { ...base, risks, limitations: DEFAULT_LIMITATIONS };
};

export const getOrganizationState = async (options: OrganizationStateOptions): Promise<OrganizationState> => buildOrganizationState(await loadRawOrganizationStateData(), options);
