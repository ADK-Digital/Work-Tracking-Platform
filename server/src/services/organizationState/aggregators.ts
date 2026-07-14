import type { CanonicalWorkItem, RawActivityEvent, RawEmployee, RawWorkItem, RecentActivitySummary } from './types';

export const isCompletedWorkItem = (item: Pick<CanonicalWorkItem, 'status'>): boolean => item.status === 'completed';

export const serializeWorkItem = (item: RawWorkItem): CanonicalWorkItem => ({
  id: item.id,
  type: String(item.type),
  title: item.title,
  description: item.description,
  status: item.statusMeta.statusKey,
  statusLabel: item.statusMeta.label,
  statusSortOrder: item.statusMeta.sortOrder,
  projectName: item.projectName,
  ownerGoogleId: item.ownerGoogleId,
  ownerEmail: item.ownerEmail,
  ownerName: item.ownerName,
  createdAt: item.createdAt.toISOString(),
  updatedAt: item.updatedAt.toISOString(),
  deletedAt: item.deletedAt?.toISOString() ?? null,
  createdBy: item.createdBy,
  updatedBy: item.updatedBy,
});

export const serializeEmployees = (employees: RawEmployee[]) => employees.map(({ googleId, email, displayName }) => ({ googleId, email, displayName }));
export const serializeActivity = (events: RawActivityEvent[]): RecentActivitySummary[] => events.map((event) => ({ id: event.id, workItemId: event.workItemId, type: String(event.type), message: event.message, timestamp: event.timestamp.toISOString(), actor: event.actor }));
