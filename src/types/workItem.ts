export type WorkItemType = "purchase_request" | "task_project";

export const PURCHASE_REQUEST_STATUSES = [
  "New",
  "Waiting on Info",
  "Submitted",
  "Approved",
  "Ordered",
  "Received/Closed",
  "Rejected/Cancelled"
] as const;

export const TASK_PROJECT_STATUSES = [
  "Backlog",
  "In Progress",
  "Blocked",
  "Done",
  "Cancelled"
] as const;

export type PurchaseRequestStatus = (typeof PURCHASE_REQUEST_STATUSES)[number];
export type TaskProjectStatus = (typeof TASK_PROJECT_STATUSES)[number];

interface WorkItemBase {
  id: string;
  type: WorkItemType;
  title: string;
  description?: string;
  status: string;
  priority?: number;
  requester: string;
  owner: string;
  createdAt: string;
  dueAt?: string;
  deleted: boolean;
}

export interface PurchaseRequestItem extends WorkItemBase {
  type: "purchase_request";
  status: PurchaseRequestStatus;
  vendor: string;
  amount: number;
  budgetCode: string;
  poNumber?: string;
}

export interface TaskProjectItem extends WorkItemBase {
  type: "task_project";
  status: TaskProjectStatus;
  category: "downtime" | "project";
  tags?: string[];
}

export type WorkItem = PurchaseRequestItem | TaskProjectItem;

export type StatusFilter = "all" | "open" | "closed" | string;
export type SortOption = "created_desc" | "created_asc" | "status_priority";

export type ActivityEventType = "created" | "updated" | "status_changed" | "owner_changed" | "deleted" | "restored";

export interface ActivityEvent {
  id: string;
  workItemId: string;
  type: ActivityEventType;
  message: string;
  actor?: string | null;
  timestamp: string;
}

export type CreateWorkItemInput = Omit<PurchaseRequestItem, "id" | "createdAt" | "deleted"> | Omit<TaskProjectItem, "id" | "createdAt" | "deleted">;
