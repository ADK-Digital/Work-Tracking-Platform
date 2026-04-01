export type WorkItemType = "purchase_request" | "task_project";

export type WorkItemStatusDefinition = {
  key: string;
  label: string;
  sortOrder: number;
};

export const PURCHASE_REQUEST_STATUSES: WorkItemStatusDefinition[] = [
  { key: "submitted", label: "Submitted", sortOrder: 1 },
  { key: "quote_requested", label: "Quote Requested", sortOrder: 2 },
  { key: "quote_received", label: "Quote Received", sortOrder: 3 },
  { key: "ordered", label: "Ordered", sortOrder: 4 },
  { key: "completed", label: "Completed", sortOrder: 5 },
];

export const TASK_PROJECT_STATUSES: WorkItemStatusDefinition[] = [
  { key: "submitted", label: "Submitted", sortOrder: 1 },
  { key: "in_progress", label: "In Progress", sortOrder: 2 },
  { key: "on_hold", label: "On Hold", sortOrder: 3 },
  { key: "completed", label: "Completed", sortOrder: 4 },
];

export type PurchaseRequestStatus = string;
export type TaskProjectStatus = string;

export interface WorkItemOwner {
  ownerGoogleId: string;
  ownerEmail: string;
  ownerName: string;
}

interface WorkItemBase extends WorkItemOwner {
  id: string;
  type: WorkItemType;
  title: string;
  description?: string;
  status: string;
  statusLabel?: string;
  statusSortOrder?: number;
  priority?: number;
  requester: string;
  createdAt: string;
  dueAt?: string;
  deleted: boolean;
  hasAttachments?: boolean;
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
  projectName?: string;
}

export interface TaskProjectOption {
  id: string;
  name: string;
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
  ownerGoogleId?: string;
  projectName?: string;
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

export type CreateWorkItemInput =
  | Omit<PurchaseRequestItem, "id" | "createdAt" | "deleted" | "requester">
  | Omit<TaskProjectItem, "id" | "createdAt" | "deleted" | "requester">;
