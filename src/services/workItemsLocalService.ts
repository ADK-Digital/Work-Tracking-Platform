import { seedWorkItems } from "../data/seedData";
import type { ActivityEvent, CreateWorkItemInput, SortOption, StatusFilter, WorkItem } from "../types/workItem";
import { generateId } from "../utils/ids";
import { sortWorkItems } from "../utils/sorting";

const STORAGE_KEY = "special-projects-tracker-work-items";
const ACTIVITY_STORAGE_KEY = "special-projects-tracker-activity-events";

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

  async resetDemoData(): Promise<void> {
    return withLatency(() => {
      writeItems(seedWorkItems);
      writeActivityEvents([]);
    });
  }
};
