import type { ActivityEventType, WorkItemType } from '@prisma/client';

export type UserRole = 'admin' | 'user';
export interface StateUser { email: string; name: string; googleSub: string; }
export interface OrganizationStateOptions { user: StateUser; role: UserRole; now?: Date; applicationVersion?: string; gitCommit?: string | null; }
export interface RawWorkItem { id: string; type: WorkItemType | string; title: string; description: string | null; statusMeta: { statusKey: string; label: string; sortOrder: number; }; projectName: string | null; ownerGoogleId: string; ownerEmail: string; ownerName: string; createdAt: Date; updatedAt: Date; deletedAt: Date | null; createdBy: string | null; updatedBy: string | null; }
export interface RawActivityEvent { id: string; workItemId: string; type: ActivityEventType | string; message: string; timestamp: Date; actor: string | null; }
export interface RawEmployee { googleId: string; email: string; displayName: string; }
export interface CanonicalWorkItem { id: string; type: string; title: string; description: string | null; status: string; statusLabel: string; statusSortOrder: number; projectName: string | null; ownerGoogleId: string; ownerEmail: string; ownerName: string; createdAt: string; updatedAt: string; deletedAt: string | null; createdBy: string | null; updatedBy: string | null; }
export interface OrganizationSnapshotMetadata { type: 'organization-state'; scope: 'full'; generatedAt: string; }
export interface OrganizationMetadata { schemaVersion: string; generatedAt: string; generatedBy: string; generatedByName: string; generatedByRole: UserRole; applicationVersion: string; gitCommit: string | null; snapshot: OrganizationSnapshotMetadata; }
export interface OwnerDirectoryInfo { groupEmail: string; source: 'google-directory' | 'mock'; available: boolean; }
export interface OrganizationInfo { ownerDirectory: OwnerDirectoryInfo; }
export interface OrganizationMetrics { totalWorkItems: number; openWorkItems: number; completedWorkItems: number; deletedWorkItems: number; ownerCount: number; namedProjectCount: number; byType: Record<string, number>; byStatus: Record<string, number>; }
export interface EmployeeSummary { googleId: string; email: string; displayName: string; }
export interface ProjectSummary { name: string; workItemCount: number; openWorkItemCount: number; completedWorkItemCount: number; deletedWorkItemCount: number; }
export interface TaskSummary { metrics: OrganizationMetrics; workItems: CanonicalWorkItem[]; }
export interface PurchaseRequestSummary { metrics: OrganizationMetrics; workItems: CanonicalWorkItem[]; }
export interface RecentActivitySummary { id: string; workItemId: string; type: string; message: string; timestamp: string; actor: string | null; }
export interface RiskSummary { id: string; type: string; severity: 'low' | 'medium' | 'high'; message: string; metadata?: Record<string, string | number | boolean | null>; }
export interface OrganizationState { metadata: OrganizationMetadata; organization: OrganizationInfo; metrics: OrganizationMetrics; employees: EmployeeSummary[]; projects: ProjectSummary[]; workItems: CanonicalWorkItem[]; tasks: TaskSummary; purchaseRequests: PurchaseRequestSummary; recentActivity: RecentActivitySummary[]; risks: RiskSummary[]; limitations: string[]; }
export interface RawOrganizationStateData { workItems: RawWorkItem[]; recentActivity: RawActivityEvent[]; employees: RawEmployee[]; ownerDirectory: OwnerDirectoryInfo; }
