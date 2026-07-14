import type { CanonicalWorkItem, OrganizationMetrics } from './types';
import { isCompletedWorkItem } from './aggregators';

export const buildMetrics = (items: CanonicalWorkItem[], ownerCount: number, namedProjectCount: number): OrganizationMetrics => {
  const byType: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  for (const item of items) {
    byType[item.type] = (byType[item.type] ?? 0) + 1;
    byStatus[item.status] = (byStatus[item.status] ?? 0) + 1;
  }
  return {
    totalWorkItems: items.length,
    openWorkItems: items.filter((item) => !item.deletedAt && !isCompletedWorkItem(item)).length,
    completedWorkItems: items.filter((item) => !item.deletedAt && isCompletedWorkItem(item)).length,
    deletedWorkItems: items.filter((item) => Boolean(item.deletedAt)).length,
    ownerCount,
    namedProjectCount,
    byType,
    byStatus,
  };
};
