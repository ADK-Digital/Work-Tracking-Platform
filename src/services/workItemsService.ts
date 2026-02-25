import { seedWorkItems } from "../data/seedData";
import type { CreateWorkItemInput, SortOption, StatusFilter, WorkItem } from "../types/workItem";
import { generateId } from "../utils/ids";
import { sortWorkItems } from "../utils/sorting";

const STORAGE_KEY = "special-projects-tracker-work-items";

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

export const workItemsService = {
  storageKey: STORAGE_KEY,

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


  async getWorkItemById(id: string): Promise<WorkItem | null> {
    return withLatency(() => {
      const item = readItems().find((workItem) => workItem.id === id);
      if (!item || item.deleted) {
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

      const updated = { ...items[index], ...patch } as WorkItem;
      items[index] = updated;
      writeItems(items);
      return updated;
    });
  },

  async softDeleteWorkItem(id: string): Promise<void> {
    return withLatency(() => {
      const items = readItems().map((item) =>
        item.id === id ? { ...item, deleted: true } : item
      );
      writeItems(items);
    });
  },

  async resetDemoData(): Promise<void> {
    return withLatency(() => {
      writeItems(seedWorkItems);
    });
  }
};
