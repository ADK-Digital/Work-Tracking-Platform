import { seedWorkItems } from "../data/seedData";
import type { ActivityEvent, Attachment, Comment, CreateWorkItemInput, SearchFilters, SearchResult, SortOption, StatusFilter, WorkItem } from "../types/workItem";
import { generateId } from "../utils/ids";
import { sortWorkItems } from "../utils/sorting";

const STORAGE_KEY = "special-projects-tracker-work-items";
const ACTIVITY_STORAGE_KEY = "special-projects-tracker-activity-events";
const COMMENTS_STORAGE_KEY = "special-projects-tracker-comments";

const TERMINAL_STATUS = {
  purchase_request: new Set(["Received/Closed", "Rejected/Cancelled"]),
  task_project: new Set(["Done", "Cancelled"])
};

const randomLatency = () => 200 + Math.floor(Math.random() * 200);
const withLatency = async <T,>(valueFactory: () => T): Promise<T> => {
  await new Promise((resolve) => setTimeout(resolve, randomLatency()));
  return valueFactory();
};

const readItems = (): WorkItem[] => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seedWorkItems));
    return [...seedWorkItems];
  }

  try {
    return JSON.parse(raw) as WorkItem[];
  } catch {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seedWorkItems));
    return [...seedWorkItems];
  }
};

const writeItems = (items: WorkItem[]): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
};

const readActivityEvents = (): ActivityEvent[] => {
  const raw = localStorage.getItem(ACTIVITY_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    return JSON.parse(raw) as ActivityEvent[];
  } catch {
    localStorage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify([]));
    return [];
  }
};

const writeActivityEvents = (events: ActivityEvent[]): void => {
  localStorage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify(events));
};

const recordActivity = (event: Omit<ActivityEvent, "id" | "timestamp">): void => {
  const events = readActivityEvents();
  events.push({
    ...event,
    id: generateId("act"),
    timestamp: new Date().toISOString()
  });
  writeActivityEvents(events);
};


const readComments = (): Comment[] => {
  const raw = localStorage.getItem(COMMENTS_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    return JSON.parse(raw) as Comment[];
  } catch {
    localStorage.setItem(COMMENTS_STORAGE_KEY, JSON.stringify([]));
    return [];
  }
};

const writeComments = (comments: Comment[]): void => {
  localStorage.setItem(COMMENTS_STORAGE_KEY, JSON.stringify(comments));
};


const includesInsensitive = (value: string | null | undefined, q: string): boolean =>
  Boolean(value && value.toLowerCase().includes(q));

const isUuid = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const isDateOnly = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value);

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

export const workItemsLocalService = {
  storageKey: STORAGE_KEY,
  activityStorageKey: ACTIVITY_STORAGE_KEY,
  commentsStorageKey: COMMENTS_STORAGE_KEY,

  async getWorkItems(params: {
    type: WorkItem["type"];
    statusFilter?: StatusFilter;
    sort?: SortOption;
    includeDeleted?: boolean;
  }): Promise<WorkItem[]> {
    const { type, statusFilter = "all", sort = "created_desc", includeDeleted = false } = params;

    return withLatency(() => {
      const items = readItems()
        .filter((item) => item.type === type)
        .filter((item) => (includeDeleted ? true : !item.deleted));

      return sortWorkItems(filterByStatus(items, statusFilter), sort);
    });
  },

  async listActivity(workItemId: string): Promise<ActivityEvent[]> {
    return withLatency(() => {
      const events = readActivityEvents().filter((event) => event.workItemId === workItemId);
      return [...events].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    });
  },

  async listComments(workItemId: string): Promise<Comment[]> {
    return withLatency(() => {
      const comments = readComments()
        .filter((comment) => comment.workItemId === workItemId && !comment.deletedAt)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      return comments;
    });
  },

  async addComment(workItemId: string, body: string): Promise<Comment> {
    return withLatency(() => {
      const trimmedBody = body.trim();
      if (!trimmedBody) {
        throw new Error("Comment body is required");
      }

      if (trimmedBody.length > 5000) {
        throw new Error("Comment body must be 5000 characters or fewer");
      }

      const comments = readComments();
      const created: Comment = {
        id: generateId("cmt"),
        workItemId,
        body: trimmedBody,
        authorEmail: "local.user@example.com",
        authorName: "Local User",
        createdAt: new Date().toISOString(),
        deletedAt: null,
        deletedBy: null,
      };

      comments.push(created);
      writeComments(comments);
      recordActivity({
        workItemId,
        type: "updated",
        message: "Comment added",
        actor: created.authorEmail,
      });

      return created;
    });
  },

  async listAttachments(_workItemId: string): Promise<Attachment[]> {
    return withLatency(() => []);
  },

  async uploadAttachment(): Promise<Attachment> {
    return withLatency(() => {
      throw new Error("Attachments require API mode");
    });
  },

  async deleteAttachment(): Promise<void> {
    return withLatency(() => {
      throw new Error("Attachments require API mode");
    });
  },

  getAttachmentDownloadUrl(_attachmentId: string): string {
    return "";
  },

  async softDeleteComment(commentId: string): Promise<void> {
    return withLatency(() => {
      const comments = readComments();
      const idx = comments.findIndex((comment) => comment.id === commentId);

      if (idx < 0) {
        throw new Error("Comment not found");
      }

      if (comments[idx].deletedAt) {
        throw new Error("Comment already deleted");
      }

      comments[idx] = {
        ...comments[idx],
        deletedAt: new Date().toISOString(),
        deletedBy: "local.admin@example.com",
      };
      writeComments(comments);
      recordActivity({
        workItemId: comments[idx].workItemId,
        type: "updated",
        message: "Comment deleted",
        actor: "local.admin@example.com",
      });
    });
  },

  async addActivity(event: Omit<ActivityEvent, "id" | "timestamp">): Promise<void> {
    return withLatency(() => {
      recordActivity(event);
    });
  },

  async getWorkItemById(id: string, options?: { includeDeleted?: boolean }): Promise<WorkItem | null> {
    return withLatency(() => {
      const item = readItems().find((workItem) => workItem.id === id);
      if (!item || (!options?.includeDeleted && item.deleted)) {
        return null;
      }

      return item;
    });
  },

  async createWorkItem(item: CreateWorkItemInput): Promise<WorkItem> {
    return withLatency(() => {
      const items = readItems();
      const created = {
        ...item,
        id: generateId(item.type === "purchase_request" ? "pr" : "tp"),
        createdAt: new Date().toISOString(),
        deleted: false
      } as WorkItem;

      items.unshift(created);
      writeItems(items);
      recordActivity({
        workItemId: created.id,
        type: "created",
        message: "Work item created"
      });
      return created;
    });
  },

  async updateWorkItem(id: string, patch: Partial<WorkItem>): Promise<WorkItem> {
    return withLatency(() => {
      const items = readItems();
      const index = items.findIndex((item) => item.id === id);

      if (index < 0) {
        throw new Error("Work item not found");
      }

      const previous = items[index];
      const updated = { ...previous, ...patch } as WorkItem;
      items[index] = updated;
      writeItems(items);

      if (patch.status !== undefined && patch.status !== previous.status) {
        recordActivity({
          workItemId: id,
          type: "status_changed",
          message: `Status changed from ${previous.status} to ${updated.status}`
        });
      } else if (patch.owner !== undefined && patch.owner !== previous.owner) {
        recordActivity({
          workItemId: id,
          type: "owner_changed",
          message: `Owner changed from ${previous.owner} to ${updated.owner}`
        });
      } else {
        recordActivity({
          workItemId: id,
          type: "updated",
          message: "Work item updated"
        });
      }

      return updated;
    });
  },

  async softDeleteWorkItem(id: string): Promise<void> {
    return withLatency(() => {
      const items = readItems().map((item) =>
        item.id === id ? { ...item, deleted: true } : item
      );
      writeItems(items);
      recordActivity({
        workItemId: id,
        type: "deleted",
        message: "Work item deleted"
      });
    });
  },


  async restoreWorkItem(id: string): Promise<WorkItem> {
    return withLatency(() => {
      const items = readItems();
      const index = items.findIndex((item) => item.id === id);

      if (index < 0) {
        throw new Error("Work item not found");
      }

      const updated = { ...items[index], deleted: false } as WorkItem;
      items[index] = updated;
      writeItems(items);
      recordActivity({
        workItemId: id,
        type: "restored",
        message: "Work item restored"
      });

      return updated;
    });
  },

  async searchWorkItems(query: string, filters: SearchFilters = {}): Promise<SearchResult[]> {
    return withLatency(() => {
      const q = query.trim().toLowerCase();
      if (!q) {
        return [];
      }

      const limit = filters.limit ?? 50;
      const items = readItems().filter((item) => {
        if (!filters.includeDeleted && item.deleted) {
          return false;
        }

        if (filters.type && item.type !== filters.type) {
          return false;
        }

        if (filters.status && item.status !== filters.status) {
          return false;
        }

        if (filters.owner && item.owner !== filters.owner) {
          return false;
        }

        return true;
      });

      const uuidQuery = isUuid(q) ? q : null;
      const dateQuery = isDateOnly(q) ? q : null;

      const results: Array<SearchResult & { sortAt: number }> = [];

      for (const item of items) {
        const matchedFields: string[] = [];
        if (includesInsensitive(item.title, q)) matchedFields.push("title");
        if (includesInsensitive(item.description, q)) matchedFields.push("description");
        if (includesInsensitive(item.status, q)) matchedFields.push("status");
        if (includesInsensitive(item.owner, q)) matchedFields.push("owner");
        if (includesInsensitive(item.type, q)) matchedFields.push("type");
        if (uuidQuery && item.id.toLowerCase() === uuidQuery) matchedFields.push("id");
        if (dateQuery && item.createdAt.slice(0, 10) === dateQuery) matchedFields.push("createdAt");

        if (matchedFields.length > 0) {
          results.push({
            kind: "workItem",
            workItem: item,
            matchedFields,
            snippet: `${item.title}${item.description ? ` — ${item.description}` : ""}`,
            sortAt: new Date(item.createdAt).getTime(),
          });
        }
      }

      const validIds = new Set(items.map((item) => item.id));

      for (const comment of readComments()) {
        if (!validIds.has(comment.workItemId) || comment.deletedAt) {
          continue;
        }

        const matchedFields: string[] = [];
        if (includesInsensitive(comment.body, q)) matchedFields.push("body");
        if (includesInsensitive(comment.authorEmail, q)) matchedFields.push("authorEmail");

        if (matchedFields.length > 0) {
          results.push({
            kind: "comment",
            workItemId: comment.workItemId,
            comment,
            matchedFields,
            snippet: comment.body,
            sortAt: new Date(comment.createdAt).getTime(),
          });
        }
      }

      for (const event of readActivityEvents()) {
        if (!validIds.has(event.workItemId)) {
          continue;
        }

        const matchedFields: string[] = [];
        if (includesInsensitive(event.message, q)) matchedFields.push("message");
        if (includesInsensitive(event.actor, q)) matchedFields.push("actor");

        if (matchedFields.length > 0) {
          results.push({
            kind: "activity",
            workItemId: event.workItemId,
            activity: event,
            matchedFields,
            snippet: event.message,
            sortAt: new Date(event.timestamp).getTime(),
          });
        }
      }

      return results
        .sort((a, b) => b.sortAt - a.sortAt)
        .slice(0, limit)
        .map(({ sortAt: _sortAt, ...result }) => result);
    });
  },

  async resetDemoData(): Promise<void> {
    return withLatency(() => {
      writeItems(seedWorkItems);
      writeActivityEvents([]);
      writeComments([]);
    });
  }
};
