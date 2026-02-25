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


export interface Comment {
  id: string;
  workItemId: string;
  body: string;
  authorEmail: string;
  authorName?: string | null;
  createdAt: string;
  deletedAt?: string | null;
  deletedBy?: string | null;
}



export interface Attachment {
  id: string;
  workItemId: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  uploadedBy: string;
  uploadedAt: string;
  deletedAt?: string | null;
  deletedBy?: string | null;
}

export interface SearchFilters {
  type?: WorkItemType;
  status?: string;
  owner?: string;
  includeDeleted?: boolean;
  limit?: number;
}

export interface WorkItemSearchResult {
  kind: "workItem";
  workItem: WorkItem;
  matchedFields: string[];
  snippet?: string;
}

export interface CommentSearchResult {
  kind: "comment";
  workItemId: string;
  comment: Comment;
  matchedFields: string[];
  snippet?: string;
}

export interface ActivitySearchResult {
  kind: "activity";
  workItemId: string;
  activity: ActivityEvent;
  matchedFields: string[];
  snippet?: string;
}



export interface AttachmentSearchResult {
  kind: "attachment";
  workItemId: string;
  attachment: Attachment;
  matchedFields: string[];
  snippet?: string;
}

export type SearchResult = WorkItemSearchResult | CommentSearchResult | ActivitySearchResult | AttachmentSearchResult;

export type CreateWorkItemInput = Omit<PurchaseRequestItem, "id" | "createdAt" | "deleted"> | Omit<TaskProjectItem, "id" | "createdAt" | "deleted">;
