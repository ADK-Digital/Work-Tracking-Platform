import { APP_MODE } from "../../config/appMode";
import { workItemsService } from "../../services/workItemsService";
import { sortWorkItems } from "../../utils/sorting";
import {
  PURCHASE_REQUEST_STATUSES,
  TASK_PROJECT_STATUSES,
  type ActivityEvent,
  type Attachment,
  type Comment,
  type CreateWorkItemInput,
  type SearchFilters,
  type SearchResult,
  type StatusFilter,
  type TaskProjectOption,
  type WorkItem,
  type WorkItemStatusDefinition,
} from "../../types/workItem";
import {
  DEMO_ACTIVITY_SEED,
  DEMO_ATTACHMENTS_SEED,
  DEMO_COMMENTS_SEED,
  DEMO_TASK_PROJECT_OPTIONS_SEED,
  DEMO_WORK_ITEMS_SEED,
} from "./demo/demoSeed";

export interface WorkItemsDataProvider {
  getWorkItems: typeof workItemsService.getWorkItems;
  listActivity: typeof workItemsService.listActivity;
  listComments: typeof workItemsService.listComments;
  addComment: typeof workItemsService.addComment;
  listStatuses: typeof workItemsService.listStatuses;
  listTaskProjectOptions: typeof workItemsService.listTaskProjectOptions;
  createTaskProjectOption: typeof workItemsService.createTaskProjectOption;
  listAttachments: typeof workItemsService.listAttachments;
  uploadAttachment: typeof workItemsService.uploadAttachment;
  deleteAttachment: typeof workItemsService.deleteAttachment;
  getAttachmentDownloadUrl: typeof workItemsService.getAttachmentDownloadUrl;
  softDeleteComment: typeof workItemsService.softDeleteComment;
  getWorkItemById: typeof workItemsService.getWorkItemById;
  createWorkItem: typeof workItemsService.createWorkItem;
  updateWorkItem: typeof workItemsService.updateWorkItem;
  completeWorkItem: typeof workItemsService.completeWorkItem;
  softDeleteWorkItem: typeof workItemsService.softDeleteWorkItem;
  restoreWorkItem: typeof workItemsService.restoreWorkItem;
  searchWorkItems: typeof workItemsService.searchWorkItems;
}

const standardWorkItemsDataProvider: WorkItemsDataProvider = workItemsService;

type DemoStore = {
  workItems: WorkItem[];
  comments: Comment[];
  activity: ActivityEvent[];
  attachments: Attachment[];
  taskProjectOptions: TaskProjectOption[];
};

const DEMO_STORE_KEY = "demo_work_items_store";
const TERMINAL_STATUS = {
  purchase_request: new Set(["completed"]),
  task_project: new Set(["completed"]),
};

let demoStoreCache: DemoStore | null = null;

const deepClone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const generateId = (prefix: string): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const nowIso = (): string => new Date().toISOString();

const getStatusDefinition = (type: WorkItem["type"], status: string): WorkItemStatusDefinition | undefined => {
  const options = type === "purchase_request" ? PURCHASE_REQUEST_STATUSES : TASK_PROJECT_STATUSES;
  return options.find((entry) => entry.key === status);
};

const buildDemoSeedStore = (): DemoStore => {
  const seed = deepClone({
    workItems: DEMO_WORK_ITEMS_SEED,
    comments: DEMO_COMMENTS_SEED,
    activity: DEMO_ACTIVITY_SEED,
    attachments: DEMO_ATTACHMENTS_SEED,
    taskProjectOptions: DEMO_TASK_PROJECT_OPTIONS_SEED,
  });

  for (const item of seed.workItems) {
    item.hasAttachments = seed.attachments.some((attachment) => attachment.workItemId === item.id && !attachment.deletedAt);
  }

  return seed;
};

const isDemoStore = (value: unknown): value is DemoStore => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<DemoStore>;

  return (
    Array.isArray(candidate.workItems) &&
    Array.isArray(candidate.comments) &&
    Array.isArray(candidate.activity) &&
    Array.isArray(candidate.attachments) &&
    Array.isArray(candidate.taskProjectOptions)
  );
};

const persistDemoStore = (store: DemoStore): void => {
  demoStoreCache = store;
  sessionStorage.setItem(DEMO_STORE_KEY, JSON.stringify(store));
};

const loadDemoStore = (): DemoStore => {
  if (demoStoreCache) {
    return demoStoreCache;
  }

  const raw = sessionStorage.getItem(DEMO_STORE_KEY);

  if (!raw) {
    const seeded = buildDemoSeedStore();
    persistDemoStore(seeded);
    return seeded;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!isDemoStore(parsed)) {
      const seeded = buildDemoSeedStore();
      persistDemoStore(seeded);
      return seeded;
    }

    const normalized = deepClone(parsed);
    demoStoreCache = normalized;
    return normalized;
  } catch {
    const seeded = buildDemoSeedStore();
    persistDemoStore(seeded);
    return seeded;
  }
};

const updateDemoStore = <T,>(updater: (draft: DemoStore) => T): T => {
  const current = loadDemoStore();
  const next = deepClone(current);
  const result = updater(next);
  persistDemoStore(next);
  return result;
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

const sortByTimestampDesc = <T extends { timestamp: string }>(items: T[]): T[] =>
  [...items].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

const addDemoActivity = (
  store: DemoStore,
  workItemId: string,
  type: ActivityEvent["type"],
  message: string,
  actor?: string,
): void => {
  store.activity.push({
    id: generateId("demo-activity"),
    workItemId,
    type,
    message,
    actor: actor ?? null,
    timestamp: nowIso(),
  });
};

const refreshAttachmentFlags = (store: DemoStore, workItemId: string): void => {
  const target = store.workItems.find((item) => item.id === workItemId);
  if (!target) {
    return;
  }

  target.hasAttachments = store.attachments.some((attachment) => attachment.workItemId === workItemId && !attachment.deletedAt);
};

const toStatusLabel = (type: WorkItem["type"], status: string): { statusLabel?: string; statusSortOrder?: number } => {
  const definition = getStatusDefinition(type, status);
  if (!definition) {
    return {};
  }

  return {
    statusLabel: definition.label,
    statusSortOrder: definition.sortOrder,
  };
};

const demoWorkItemsDataProvider: WorkItemsDataProvider = {
  ...workItemsService,
  async getWorkItems(params): Promise<WorkItem[]> {
    const { type, statusFilter = "all", sort = "created_desc", includeDeleted = false } = params;
    const store = loadDemoStore();
    const filtered = store.workItems
      .filter((item) => item.type === type)
      .filter((item) => (includeDeleted ? true : !item.deleted));

    return sortWorkItems(filterByStatus(filtered, statusFilter), sort);
  },

  async listActivity(workItemId): Promise<ActivityEvent[]> {
    const store = loadDemoStore();
    return sortByTimestampDesc(store.activity.filter((event) => event.workItemId === workItemId));
  },

  async listComments(workItemId): Promise<Comment[]> {
    const store = loadDemoStore();
    return [...store.comments]
      .filter((comment) => comment.workItemId === workItemId && !comment.deletedAt)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  async addComment(workItemId, body): Promise<Comment> {
    return updateDemoStore((store) => {
      const hasItem = store.workItems.some((item) => item.id === workItemId);
      if (!hasItem) {
        throw new Error("Work item not found");
      }

      const comment: Comment = {
        id: generateId("demo-comment"),
        workItemId,
        body,
        authorEmail: "demo.user@internal.example",
        authorName: "Demo User",
        createdAt: nowIso(),
        deletedAt: null,
        deletedBy: null,
      };

      store.comments.push(comment);
      addDemoActivity(store, workItemId, "updated", "comment added", "Demo User");
      return comment;
    });
  },

  async listStatuses(type): Promise<WorkItemStatusDefinition[]> {
    if (!type) {
      return [...PURCHASE_REQUEST_STATUSES, ...TASK_PROJECT_STATUSES];
    }

    return type === "purchase_request" ? PURCHASE_REQUEST_STATUSES : TASK_PROJECT_STATUSES;
  },

  async listTaskProjectOptions(): Promise<TaskProjectOption[]> {
    const store = loadDemoStore();
    const names = new Map<string, TaskProjectOption>();

    for (const option of store.taskProjectOptions) {
      names.set(option.name.trim().toLowerCase(), option);
    }

    for (const item of store.workItems) {
      if (item.type !== "task_project" || !item.projectName?.trim()) {
        continue;
      }

      const key = item.projectName.trim().toLowerCase();
      if (!names.has(key)) {
        names.set(key, { id: generateId("demo-project-option"), name: item.projectName.trim() });
      }
    }

    return [...names.values()].sort((a, b) => a.name.localeCompare(b.name));
  },

  async createTaskProjectOption(name): Promise<TaskProjectOption> {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new Error("Project option name is required");
    }

    return updateDemoStore((store) => {
      const existing = store.taskProjectOptions.find((option) => option.name.trim().toLowerCase() === trimmed.toLowerCase());
      if (existing) {
        return existing;
      }

      const option = { id: generateId("demo-project-option"), name: trimmed };
      store.taskProjectOptions.push(option);
      return option;
    });
  },

  async listAttachments(workItemId): Promise<Attachment[]> {
    const store = loadDemoStore();
    return store.attachments
      .filter((attachment) => attachment.workItemId === workItemId && !attachment.deletedAt)
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
  },

  async uploadAttachment(workItemId, file): Promise<Attachment> {
    return updateDemoStore((store) => {
      const target = store.workItems.find((item) => item.id === workItemId);
      if (!target) {
        throw new Error("Work item not found");
      }

      const attachment: Attachment = {
        id: generateId("demo-attachment"),
        workItemId,
        filename: file.name,
        contentType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        uploadedBy: "demo.user@internal.example",
        uploadedAt: nowIso(),
        deletedAt: null,
        deletedBy: null,
      };

      store.attachments.push(attachment);
      refreshAttachmentFlags(store, workItemId);
      addDemoActivity(store, workItemId, "updated", `attachment uploaded: ${file.name}`, "Demo User");
      return attachment;
    });
  },

  async deleteAttachment(attachmentId): Promise<void> {
    updateDemoStore((store) => {
      const attachment = store.attachments.find((candidate) => candidate.id === attachmentId);
      if (!attachment || attachment.deletedAt) {
        return;
      }

      attachment.deletedAt = nowIso();
      attachment.deletedBy = "demo.user@internal.example";
      refreshAttachmentFlags(store, attachment.workItemId);
      addDemoActivity(store, attachment.workItemId, "updated", `attachment deleted: ${attachment.filename}`, "Demo User");
    });
  },

  getAttachmentDownloadUrl(attachmentId): string {
    return `#demo-attachment-${attachmentId}`;
  },

  async softDeleteComment(commentId): Promise<void> {
    updateDemoStore((store) => {
      const comment = store.comments.find((candidate) => candidate.id === commentId);
      if (!comment || comment.deletedAt) {
        return;
      }

      comment.deletedAt = nowIso();
      comment.deletedBy = "demo.user@internal.example";
      addDemoActivity(store, comment.workItemId, "updated", "comment deleted", "Demo User");
    });
  },

  async getWorkItemById(id, options): Promise<WorkItem | null> {
    const store = loadDemoStore();
    const found = store.workItems.find((item) => item.id === id) ?? null;
    if (!found) {
      return null;
    }

    if (!options?.includeDeleted && found.deleted) {
      return null;
    }

    return deepClone(found);
  },

  async createWorkItem(item: CreateWorkItemInput): Promise<WorkItem> {
    return updateDemoStore((store) => {
      const id = generateId("demo-item");
      const timestamp = nowIso();

      const common = {
        id,
        type: item.type,
        title: item.title,
        description: item.description,
        status: item.status,
        priority: item.priority,
        requester: "Demo User",
        ownerGoogleId: item.ownerGoogleId,
        ownerEmail: item.ownerEmail,
        ownerName: item.ownerName,
        createdAt: timestamp,
        dueAt: item.dueAt,
        deleted: false,
        hasAttachments: false,
      };

      const created: WorkItem = item.type === "purchase_request"
        ? {
            ...common,
            type: "purchase_request",
            vendor: item.vendor,
            amount: item.amount,
            budgetCode: item.budgetCode,
            poNumber: item.poNumber,
            ...toStatusLabel("purchase_request", item.status),
          }
        : {
            ...common,
            type: "task_project",
            category: item.category,
            tags: item.tags,
            projectName: item.projectName,
            ...toStatusLabel("task_project", item.status),
          };

      store.workItems.push(created);
      addDemoActivity(store, created.id, "created", "Work item created", "Demo User");
      return created;
    });
  },

  async updateWorkItem(id, patch): Promise<WorkItem> {
    return updateDemoStore((store) => {
      const index = store.workItems.findIndex((item) => item.id === id);
      if (index < 0) {
        throw new Error("Work item not found");
      }

      const current = store.workItems[index];
      const nextStatus = patch.status ?? current.status;

      const updatedBase = {
        ...current,
        ...patch,
        id: current.id,
        type: current.type,
        createdAt: current.createdAt,
        deleted: current.deleted,
      };

      const updated: WorkItem = current.type === "purchase_request"
        ? {
            ...updatedBase,
            type: "purchase_request",
            vendor: (patch as Partial<Extract<WorkItem, { type: "purchase_request" }>>).vendor ?? current.vendor,
            amount: (patch as Partial<Extract<WorkItem, { type: "purchase_request" }>>).amount ?? current.amount,
            budgetCode: (patch as Partial<Extract<WorkItem, { type: "purchase_request" }>>).budgetCode ?? current.budgetCode,
            poNumber: (patch as Partial<Extract<WorkItem, { type: "purchase_request" }>>).poNumber ?? current.poNumber,
            ...toStatusLabel("purchase_request", nextStatus),
          }
        : {
            ...updatedBase,
            type: "task_project",
            category: (patch as Partial<Extract<WorkItem, { type: "task_project" }>>).category ?? current.category,
            tags: (patch as Partial<Extract<WorkItem, { type: "task_project" }>>).tags ?? current.tags,
            projectName: (patch as Partial<Extract<WorkItem, { type: "task_project" }>>).projectName ?? current.projectName,
            ...toStatusLabel("task_project", nextStatus),
          };

      store.workItems[index] = updated;
      if (patch.status && patch.status !== current.status) {
        addDemoActivity(store, id, "status_changed", `Status changed to ${updated.statusLabel ?? updated.status}`, "Demo User");
      } else {
        addDemoActivity(store, id, "updated", "Work item updated", "Demo User");
      }

      return updated;
    });
  },

  async completeWorkItem(id): Promise<WorkItem> {
    return updateDemoStore((store) => {
      const index = store.workItems.findIndex((item) => item.id === id);
      if (index < 0) {
        throw new Error("Work item not found");
      }

      const current = store.workItems[index];
      const labelPatch = toStatusLabel(current.type, "completed");
      const updated: WorkItem = {
        ...current,
        status: "completed",
        ...labelPatch,
      };

      store.workItems[index] = updated;
      addDemoActivity(store, id, "status_changed", "Status changed to Completed", "Demo User");
      return updated;
    });
  },

  async softDeleteWorkItem(id): Promise<void> {
    updateDemoStore((store) => {
      const target = store.workItems.find((item) => item.id === id);
      if (!target || target.deleted) {
        return;
      }

      target.deleted = true;
      addDemoActivity(store, id, "deleted", "Work item deleted", "Demo User");
    });
  },

  async restoreWorkItem(id): Promise<WorkItem> {
    return updateDemoStore((store) => {
      const target = store.workItems.find((item) => item.id === id);
      if (!target) {
        throw new Error("Work item not found");
      }

      target.deleted = false;
      addDemoActivity(store, id, "restored", "Work item restored", "Demo User");
      return deepClone(target);
    });
  },

  async searchWorkItems(query: string, filters: SearchFilters = {}): Promise<SearchResult[]> {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return [];
    }

    const store = loadDemoStore();

    const matchesFilter = (item: WorkItem): boolean => {
      if (filters.type && item.type !== filters.type) {
        return false;
      }

      if (filters.status && item.status !== filters.status) {
        return false;
      }

      if (filters.ownerGoogleId && item.ownerGoogleId !== filters.ownerGoogleId) {
        return false;
      }

      if (filters.projectName && item.type === "task_project") {
        if (filters.projectName === "none") {
          return !item.projectName?.trim();
        }

        if (item.projectName !== filters.projectName) {
          return false;
        }
      }

      if (!filters.includeDeleted && item.deleted) {
        return false;
      }

      return true;
    };

    const byId = new Map(store.workItems.map((item) => [item.id, item]));
    const limit = filters.limit ?? 50;
    const results: SearchResult[] = [];

    for (const item of store.workItems) {
      if (!matchesFilter(item)) {
        continue;
      }

      const haystack = [item.title, item.description, item.ownerName, item.ownerEmail, item.requester].filter(Boolean).join(" ").toLowerCase();
      if (haystack.includes(normalizedQuery)) {
        results.push({
          kind: "workItem",
          workItem: deepClone(item),
          matchedFields: ["title"],
        });
      }
    }

    for (const comment of store.comments) {
      if (comment.deletedAt) {
        continue;
      }

      const item = byId.get(comment.workItemId);
      if (!item || !matchesFilter(item)) {
        continue;
      }

      if (comment.body.toLowerCase().includes(normalizedQuery)) {
        results.push({
          kind: "comment",
          workItemId: comment.workItemId,
          comment: deepClone(comment),
          matchedFields: ["body"],
        });
      }
    }

    for (const event of store.activity) {
      const item = byId.get(event.workItemId);
      if (!item || !matchesFilter(item)) {
        continue;
      }

      if (`${event.message} ${event.type}`.toLowerCase().includes(normalizedQuery)) {
        results.push({
          kind: "activity",
          workItemId: event.workItemId,
          activity: deepClone(event),
          matchedFields: ["message"],
        });
      }
    }

    for (const attachment of store.attachments) {
      if (attachment.deletedAt) {
        continue;
      }

      const item = byId.get(attachment.workItemId);
      if (!item || !matchesFilter(item)) {
        continue;
      }

      if (attachment.filename.toLowerCase().includes(normalizedQuery)) {
        results.push({
          kind: "attachment",
          workItemId: attachment.workItemId,
          attachment: deepClone(attachment),
          matchedFields: ["filename"],
        });
      }
    }

    return results.slice(0, limit);
  },
};

export const getWorkItemsDataProvider = (): WorkItemsDataProvider =>
  APP_MODE === "demo" ? demoWorkItemsDataProvider : standardWorkItemsDataProvider;
