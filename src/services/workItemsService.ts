import { workItemsApiService } from "./workItemsApiService";
import { ApiError } from "./http";

export const API_ERROR_EVENT = "work-items-api-error";
export const API_UNAUTHORIZED_EVENT = "work-items-api-unauthorized";
export const API_FORBIDDEN_EVENT = "work-items-api-forbidden";

const baseService = workItemsApiService;

const reportApiError = (error: unknown): never => {
  if (error instanceof ApiError && error.status === 401) {
    const message = "Please sign in to continue";
    window.dispatchEvent(new CustomEvent(API_UNAUTHORIZED_EVENT, { detail: message }));
    throw error;
  }

  if (error instanceof ApiError && error.status === 403) {
    const message = "You do not have permission to perform this action.";
    window.dispatchEvent(new CustomEvent(API_FORBIDDEN_EVENT, { detail: message }));
    throw error;
  }

  const message = "Backend unavailable; check server and VITE_API_BASE_URL";
  console.error(message, error);
  window.dispatchEvent(new CustomEvent(API_ERROR_EVENT, { detail: message }));
  throw error;
};

const invoke = async <T,>(operation: () => Promise<T>): Promise<T> => {
  try {
    return await operation();
  } catch (error) {
    return reportApiError(error);
  }
};

export const workItemsService = {
  ...baseService,
  getWorkItems: (...args: Parameters<typeof baseService.getWorkItems>) => invoke(() => baseService.getWorkItems(...args)),
  listActivity: (...args: Parameters<typeof baseService.listActivity>) => invoke(() => baseService.listActivity(...args)),
  listComments: (...args: Parameters<typeof baseService.listComments>) => invoke(() => baseService.listComments(...args)),
  addComment: (...args: Parameters<typeof baseService.addComment>) => invoke(() => baseService.addComment(...args)),
  listStatuses: (...args: Parameters<typeof baseService.listStatuses>) => invoke(() => baseService.listStatuses(...args)),
  listTaskProjectOptions: (...args: Parameters<typeof baseService.listTaskProjectOptions>) => invoke(() => baseService.listTaskProjectOptions(...args)),
  createTaskProjectOption: (...args: Parameters<typeof baseService.createTaskProjectOption>) => invoke(() => baseService.createTaskProjectOption(...args)),
  listAttachments: (...args: Parameters<typeof baseService.listAttachments>) => invoke(() => baseService.listAttachments(...args)),
  uploadAttachment: (...args: Parameters<typeof baseService.uploadAttachment>) => invoke(() => baseService.uploadAttachment(...args)),
  deleteAttachment: (...args: Parameters<typeof baseService.deleteAttachment>) => invoke(() => baseService.deleteAttachment(...args)),
  getAttachmentDownloadUrl: (...args: Parameters<typeof baseService.getAttachmentDownloadUrl>) => baseService.getAttachmentDownloadUrl(...args),
  softDeleteComment: (...args: Parameters<typeof baseService.softDeleteComment>) => invoke(() => baseService.softDeleteComment(...args)),
  getWorkItemById: (...args: Parameters<typeof baseService.getWorkItemById>) => invoke(() => baseService.getWorkItemById(...args)),
  createWorkItem: (...args: Parameters<typeof baseService.createWorkItem>) => invoke(() => baseService.createWorkItem(...args)),
  updateWorkItem: (...args: Parameters<typeof baseService.updateWorkItem>) => invoke(() => baseService.updateWorkItem(...args)),
  completeWorkItem: (...args: Parameters<typeof baseService.completeWorkItem>) => invoke(() => baseService.completeWorkItem(...args)),
  softDeleteWorkItem: (...args: Parameters<typeof baseService.softDeleteWorkItem>) => invoke(() => baseService.softDeleteWorkItem(...args)),
  restoreWorkItem: (...args: Parameters<typeof baseService.restoreWorkItem>) => invoke(() => baseService.restoreWorkItem(...args)),
  searchWorkItems: (...args: Parameters<typeof baseService.searchWorkItems>) => invoke(() => baseService.searchWorkItems(...args)),
};
