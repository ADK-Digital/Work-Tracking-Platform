import { workItemsApiService } from "./workItemsApiService";
import { workItemsLocalService } from "./workItemsLocalService";
import { ApiError } from "./http";

export const API_ERROR_EVENT = "work-items-api-error";
export const API_UNAUTHORIZED_EVENT = "work-items-api-unauthorized";
export const API_FORBIDDEN_EVENT = "work-items-api-forbidden";

const useApi = import.meta.env.VITE_USE_API === "true";
const baseService = useApi ? workItemsApiService : workItemsLocalService;

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

export const workItemsService = {
  ...baseService,
  async getWorkItems(...args: Parameters<typeof baseService.getWorkItems>) {
    try {
      return await baseService.getWorkItems(...args);
    } catch (error) {
      if (useApi) {
        reportApiError(error);
      }

      throw error;
    }
  },
  async listActivity(...args: Parameters<typeof baseService.listActivity>) {
    try {
      return await baseService.listActivity(...args);
    } catch (error) {
      if (useApi) {
        reportApiError(error);
      }

      throw error;
    }
  },
  async listComments(...args: Parameters<typeof baseService.listComments>) {
    try {
      return await baseService.listComments(...args);
    } catch (error) {
      if (useApi) {
        reportApiError(error);
      }

      throw error;
    }
  },
  async addComment(...args: Parameters<typeof baseService.addComment>) {
    try {
      return await baseService.addComment(...args);
    } catch (error) {
      if (useApi) {
        reportApiError(error);
      }

      throw error;
    }
  },
  async listAttachments(...args: Parameters<typeof baseService.listAttachments>) {
    try {
      return await baseService.listAttachments(...args);
    } catch (error) {
      if (useApi) {
        reportApiError(error);
      }

      throw error;
    }
  },
  async uploadAttachment(...args: Parameters<typeof baseService.uploadAttachment>) {
    try {
      return await baseService.uploadAttachment(...args);
    } catch (error) {
      if (useApi) {
        reportApiError(error);
      }

      throw error;
    }
  },
  async deleteAttachment(...args: Parameters<typeof baseService.deleteAttachment>) {
    try {
      return await baseService.deleteAttachment(...args);
    } catch (error) {
      if (useApi) {
        reportApiError(error);
      }

      throw error;
    }
  },
  getAttachmentDownloadUrl(...args: Parameters<typeof baseService.getAttachmentDownloadUrl>) {
    return baseService.getAttachmentDownloadUrl(...args);
  },
  async softDeleteComment(...args: Parameters<typeof baseService.softDeleteComment>) {
    try {
      return await baseService.softDeleteComment(...args);
    } catch (error) {
      if (useApi) {
        reportApiError(error);
      }

      throw error;
    }
  },
  async getWorkItemById(...args: Parameters<typeof baseService.getWorkItemById>) {
    try {
      return await baseService.getWorkItemById(...args);
    } catch (error) {
      if (useApi) {
        reportApiError(error);
      }

      throw error;
    }
  },
  async createWorkItem(...args: Parameters<typeof baseService.createWorkItem>) {
    try {
      return await baseService.createWorkItem(...args);
    } catch (error) {
      if (useApi) {
        reportApiError(error);
      }

      throw error;
    }
  },
  async updateWorkItem(...args: Parameters<typeof baseService.updateWorkItem>) {
    try {
      return await baseService.updateWorkItem(...args);
    } catch (error) {
      if (useApi) {
        reportApiError(error);
      }

      throw error;
    }
  },
  async softDeleteWorkItem(...args: Parameters<typeof baseService.softDeleteWorkItem>) {
    try {
      return await baseService.softDeleteWorkItem(...args);
    } catch (error) {
      if (useApi) {
        reportApiError(error);
      }

      throw error;
    }
  },

  async restoreWorkItem(...args: Parameters<typeof baseService.restoreWorkItem>) {
    try {
      return await baseService.restoreWorkItem(...args);
    } catch (error) {
      if (useApi) {
        reportApiError(error);
      }

      throw error;
    }
  },
  async searchWorkItems(...args: Parameters<typeof baseService.searchWorkItems>) {
    try {
      return await baseService.searchWorkItems(...args);
    } catch (error) {
      if (useApi) {
        reportApiError(error);
      }

      throw error;
    }
  },
  async resetDemoData(...args: Parameters<typeof baseService.resetDemoData>) {
    try {
      return await baseService.resetDemoData(...args);
    } catch (error) {
      if (useApi) {
        reportApiError(error);
      }

      throw error;
    }
  }
};

export const isApiModeEnabled = useApi;
