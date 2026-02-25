import { apiFetch } from "./http";
import type {
  ActivityEvent,
  Comment,
  CreateWorkItemInput,
  PurchaseRequestStatus,
  SortOption,
  StatusFilter,
  TaskProjectStatus,
  WorkItem,
  SearchFilters,
  SearchResult
} from "../types/workItem";
import { sortWorkItems } from "../utils/sorting";

const TERMINAL_STATUS = {
  purchase_request: new Set(["Received/Closed", "Rejected/Cancelled"]),
  task_project: new Set(["Done", "Cancelled"])
};

const filterByStatus = (items: WorkItem[], statusFilter: StatusFilter): WorkItem[] => {
  if (!statusFilter || statusFilter === "all") {
    return items;
  }

  if (statusFilter === "open") {
    return items.filter((item) => !TERMINAL_STATUS[item.type].has(item.status));
  }

  if (statusFilter === "closed") {
    return items.filter((item) => TERMINAL_STATUS[item.type].has(item.status));
  }

  return items.filter((item) => item.status === statusFilter);
};

type BackendWorkItem = {
  id: string;
  type: "purchase_request" | "task";
  title: string;
  description?: string | null;
  status: string;
  owner?: string | null;
  createdAt: string;
  updatedAt?: string;
  deletedAt?: string | null;
};


type BackendComment = {
  id: string;
  workItemId: string;
  body: string;
  authorEmail: string;
  authorName?: string | null;
  createdAt: string;
  deletedAt?: string | null;
  deletedBy?: string | null;
};

const normalizeComment = (comment: BackendComment): Comment => ({
  ...comment,
  createdAt: new Date(comment.createdAt).toISOString(),
  deletedAt: comment.deletedAt ? new Date(comment.deletedAt).toISOString() : null,
});


type BackendSearchResult =
  | {
      kind: "workItem";
      workItem: BackendWorkItem;
      matchedFields: string[];
      snippet?: string;
    }
  | {
      kind: "comment";
      workItemId: string;
      comment: BackendComment;
      matchedFields: string[];
      snippet?: string;
    }
  | {
      kind: "activity";
      workItemId: string;
      activity: ActivityEvent;
      matchedFields: string[];
      snippet?: string;
    };

const normalizeWorkItem = (item: BackendWorkItem): WorkItem => {
  if (item.type === "purchase_request") {
    return {
      id: item.id,
      type: "purchase_request",
      title: item.title,
      description: item.description ?? undefined,
      status: item.status as PurchaseRequestStatus,
      priority: 2,
      requester: "Unassigned",
      owner: item.owner ?? "Unassigned",
      createdAt: new Date(item.createdAt).toISOString(),
      dueAt: undefined,
      deleted: Boolean(item.deletedAt),
      vendor: "Unknown",
      amount: 0,
      budgetCode: "N/A",
      poNumber: undefined
    };
  }

  return {
    id: item.id,
    type: "task_project",
    title: item.title,
    description: item.description ?? undefined,
    status: item.status as TaskProjectStatus,
    priority: 2,
    requester: "Unassigned",
    owner: item.owner ?? "Unassigned",
    createdAt: new Date(item.createdAt).toISOString(),
    dueAt: undefined,
    deleted: Boolean(item.deletedAt),
    category: "project",
    tags: []
  };
};

export const workItemsApiService = {
  storageKey: "special-projects-tracker-work-items",
  activityStorageKey: "special-projects-tracker-activity-events",

  async getWorkItems(params: {
    type: WorkItem["type"];
    statusFilter?: StatusFilter;
    sort?: SortOption;
    includeDeleted?: boolean;
  }): Promise<WorkItem[]> {
    const { type, statusFilter = "all", sort = "created_desc", includeDeleted = false } = params;

    const apiType = type === "task_project" ? "task" : type;
    const items = await apiFetch<BackendWorkItem[]>("/api/work-items", {
      query: {
        type: apiType,
        includeDeleted
      }
    });

    const normalized = items.map(normalizeWorkItem).filter((item) => (includeDeleted ? true : !item.deleted));
    return sortWorkItems(filterByStatus(normalized, statusFilter), sort);
  },

  async listActivity(workItemId: string): Promise<ActivityEvent[]> {
    const events = await apiFetch<ActivityEvent[]>(`/api/work-items/${workItemId}/activity`);

    return events
      .map((event) => ({
        ...event,
        timestamp: new Date(event.timestamp).toISOString()
      }))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  },

  async listComments(workItemId: string): Promise<Comment[]> {
    const comments = await apiFetch<BackendComment[]>(`/api/work-items/${workItemId}/comments`);
    return comments.map(normalizeComment);
  },

  async addComment(workItemId: string, body: string): Promise<Comment> {
    const comment = await apiFetch<BackendComment>(`/api/work-items/${workItemId}/comments`, {
      method: "POST",
      body: JSON.stringify({ body })
    });

    return normalizeComment(comment);
  },

  async softDeleteComment(commentId: string): Promise<void> {
    await apiFetch<void>(`/api/comments/${commentId}`, {
      method: "DELETE"
    });
  },

  async addActivity(_event: Omit<ActivityEvent, "id" | "timestamp">): Promise<void> {
    return Promise.resolve();
  },

  async getWorkItemById(id: string, options?: { includeDeleted?: boolean }): Promise<WorkItem | null> {
    try {
      const item = await apiFetch<BackendWorkItem>(`/api/work-items/${id}`);
      const normalized = normalizeWorkItem(item);
      return options?.includeDeleted ? normalized : (normalized.deleted ? null : normalized);
    } catch (error) {
      if (error instanceof Error && error.message.includes("API 404")) {
        return null;
      }

      throw error;
    }
  },

  async createWorkItem(item: CreateWorkItemInput): Promise<WorkItem> {
    const payload = {
      type: item.type === "task_project" ? "task" : item.type,
      title: item.title,
      description: item.description,
      status: item.status,
      owner: item.owner
    };

    const created = await apiFetch<BackendWorkItem>("/api/work-items", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    return normalizeWorkItem(created);
  },

  async updateWorkItem(id: string, patch: Partial<WorkItem>): Promise<WorkItem> {
    const payload = {
      ...(patch.type ? { type: patch.type === "task_project" ? "task" : patch.type } : {}),
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.owner !== undefined ? { owner: patch.owner } : {})
    };

    const updated = await apiFetch<BackendWorkItem>(`/api/work-items/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });

    return normalizeWorkItem(updated);
  },

  async softDeleteWorkItem(id: string): Promise<void> {
    await apiFetch<void>(`/api/work-items/${id}`, {
      method: "DELETE"
    });
  },


  async restoreWorkItem(id: string): Promise<WorkItem> {
    const restored = await apiFetch<BackendWorkItem>(`/api/work-items/${id}/restore`, {
      method: "POST"
    });

    return normalizeWorkItem(restored);
  },

  async searchWorkItems(query: string, filters: SearchFilters = {}): Promise<SearchResult[]> {
    if (!query.trim()) {
      return [];
    }

    const apiType = filters.type ? (filters.type === "task_project" ? "task" : filters.type) : undefined;

    const response = await apiFetch<{ results: BackendSearchResult[] }>("/api/search", {
      query: {
        q: query.trim(),
        type: apiType,
        status: filters.status,
        owner: filters.owner,
        includeDeleted: filters.includeDeleted,
        limit: filters.limit ?? 50,
      },
    });

    return response.results.map((result) => {
      if (result.kind === "workItem") {
        return {
          kind: "workItem",
          workItem: normalizeWorkItem(result.workItem),
          matchedFields: result.matchedFields,
          snippet: result.snippet,
        };
      }

      if (result.kind === "comment") {
        return {
          kind: "comment",
          workItemId: result.workItemId,
          comment: normalizeComment(result.comment),
          matchedFields: result.matchedFields,
          snippet: result.snippet,
        };
      }

      return {
        kind: "activity",
        workItemId: result.workItemId,
        activity: {
          ...result.activity,
          timestamp: new Date(result.activity.timestamp).toISOString(),
        },
        matchedFields: result.matchedFields,
        snippet: result.snippet,
      };
    });
  },

  async resetDemoData(): Promise<void> {
    console.warn("Reset demo data is not supported in API mode.");
  }
};
