import type { CanonicalWorkItem, ProjectSummary } from './types';
import { isCompletedWorkItem } from './aggregators';

export const aggregateProjects = (items: CanonicalWorkItem[]): ProjectSummary[] => {
  const projects = new Map<string, ProjectSummary>();
  for (const item of items) {
    if (item.type !== 'task' || !item.projectName?.trim()) continue;
    const name = item.projectName.trim();
    const project = projects.get(name) ?? { name, workItemCount: 0, openWorkItemCount: 0, completedWorkItemCount: 0, deletedWorkItemCount: 0 };
    project.workItemCount += 1;
    if (item.deletedAt) project.deletedWorkItemCount += 1;
    else if (isCompletedWorkItem(item)) project.completedWorkItemCount += 1;
    else project.openWorkItemCount += 1;
    projects.set(name, project);
  }
  return [...projects.values()].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
};
