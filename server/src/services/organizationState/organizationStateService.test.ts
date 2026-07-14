import assert from 'node:assert/strict';
import { buildOrganizationState } from './organizationStateService';
import type { RawOrganizationStateData, RawWorkItem } from './types';

const date = (value: string) => new Date(value);
const user = { email: 'tester@example.org', name: 'Test User', googleSub: 'google-1' };

const item = (overrides: Partial<RawWorkItem>): RawWorkItem => ({
  id: 'item-1', type: 'task', title: 'Task', description: null, statusMeta: { statusKey: 'submitted', label: 'Submitted', sortOrder: 1 }, projectName: 'Alpha', ownerGoogleId: 'owner-1', ownerEmail: 'owner@example.org', ownerName: 'Owner', createdAt: date('2026-01-01T00:00:00.000Z'), updatedAt: date('2026-01-02T00:00:00.000Z'), deletedAt: null, createdBy: 'creator@example.org', updatedBy: null, ...overrides,
});

const raw = (workItems: RawWorkItem[] = []): RawOrganizationStateData => ({
  workItems,
  recentActivity: [{ id: 'event-1', workItemId: 'item-1', type: 'created', message: 'Created', timestamp: date('2026-01-03T00:00:00.000Z'), actor: 'tester@example.org' }],
  employees: [{ googleId: 'owner-1', email: 'owner@example.org', displayName: 'Owner' }],
  ownerDirectory: { groupEmail: 'owners@example.org', source: 'mock', available: false },
});

const options = { user, role: 'admin' as const, now: date('2026-07-14T12:00:00.000Z'), applicationVersion: '9.9.9', gitCommit: 'abc1234' };

{
  const state = buildOrganizationState(raw(), options);
  assert.deepEqual(Object.keys(state), ['metadata', 'organization', 'metrics', 'employees', 'projects', 'workItems', 'tasks', 'purchaseRequests', 'recentActivity', 'risks', 'limitations']);
  assert.equal(state.metadata.generatedAt, '2026-07-14T12:00:00.000Z');
  assert.deepEqual(state.metadata.snapshot, { type: 'organization-state', scope: 'full', generatedAt: '2026-07-14T12:00:00.000Z' });
  assert.equal(state.metadata.applicationVersion, '9.9.9');
  assert.equal(state.metadata.gitCommit, 'abc1234');
}

{
  const state = buildOrganizationState(raw([
    item({ id: 'task-open', type: 'task', statusMeta: { statusKey: 'submitted', label: 'Submitted', sortOrder: 1 }, projectName: 'Alpha' }),
    item({ id: 'task-done', type: 'task', statusMeta: { statusKey: 'completed', label: 'Completed', sortOrder: 2 }, projectName: 'Alpha' }),
    item({ id: 'task-deleted', type: 'task', deletedAt: date('2026-01-04T00:00:00.000Z'), projectName: 'Beta' }),
    item({ id: 'pr-open', type: 'purchase_request', statusMeta: { statusKey: 'submitted', label: 'Submitted', sortOrder: 1 }, projectName: null }),
  ]), options);
  assert.equal(state.metrics.totalWorkItems, 4);
  assert.equal(state.metrics.openWorkItems, 2);
  assert.equal(state.metrics.completedWorkItems, 1);
  assert.equal(state.metrics.deletedWorkItems, 1);
  assert.deepEqual(state.metrics.byType, { task: 3, purchase_request: 1 });
  assert.equal(state.tasks.workItems.length, 3);
  assert.equal(state.purchaseRequests.workItems.length, 1);
  assert.deepEqual(state.projects, [
    { name: 'Alpha', workItemCount: 2, openWorkItemCount: 1, completedWorkItemCount: 1, deletedWorkItemCount: 0 },
    { name: 'Beta', workItemCount: 1, openWorkItemCount: 0, completedWorkItemCount: 0, deletedWorkItemCount: 1 },
  ]);
}

{
  const state = buildOrganizationState(raw(), options);
  assert.equal(state.metrics.totalWorkItems, 0);
  assert.deepEqual(state.projects, []);
  assert.deepEqual(state.workItems, []);
  assert.deepEqual(state.risks, []);
  assert.ok(state.limitations.length >= 5);
}

console.log('organization-state tests passed');
