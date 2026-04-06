import { APP_MODE } from "../../config/appMode";
import { workItemsService } from "../../services/workItemsService";
import { DEMO_WORK_ITEMS_SEED } from "./demo/demoSeed";

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

const demoWorkItemsDataProvider: WorkItemsDataProvider = {
  ...workItemsService,
  // Placeholder seam for a future in-memory/session-scoped demo implementation.
  // The seed import keeps the extension point explicit and discoverable.
  getWorkItems: async (...args) => {
    void DEMO_WORK_ITEMS_SEED;
    return workItemsService.getWorkItems(...args);
  },
};

export const getWorkItemsDataProvider = (): WorkItemsDataProvider =>
  APP_MODE === "demo" ? demoWorkItemsDataProvider : standardWorkItemsDataProvider;
