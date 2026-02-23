import {
  PURCHASE_REQUEST_STATUSES,
  TASK_PROJECT_STATUSES,
  type SortOption,
  type WorkItem
} from "../types/workItem";

const PURCHASE_STATUS_PRIORITY = new Map(
  PURCHASE_REQUEST_STATUSES.map((status, index) => [status, index])
);

const TASK_STATUS_PRIORITY = new Map(
  ["Blocked", "In Progress", "Backlog", "Done", "Cancelled"].map((status, index) => [
    status,
    index
  ])
);

const getStatusWeight = (item: WorkItem): number => {
  if (item.type === "purchase_request") {
    return PURCHASE_STATUS_PRIORITY.get(item.status) ?? PURCHASE_REQUEST_STATUSES.length;
  }

  return TASK_STATUS_PRIORITY.get(item.status) ?? TASK_PROJECT_STATUSES.length;
};

export const sortWorkItems = (items: WorkItem[], sort: SortOption = "created_desc"): WorkItem[] => {
  const next = [...items];

  next.sort((a, b) => {
    if (sort === "created_asc") {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    }

    if (sort === "status_priority") {
      const statusDiff = getStatusWeight(a) - getStatusWeight(b);
      if (statusDiff !== 0) {
        return statusDiff;
      }

      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }

    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return next;
};
