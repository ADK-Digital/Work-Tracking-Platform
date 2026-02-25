import { workItemsApiService } from "./workItemsApiService";
import { workItemsLocalService } from "./workItemsLocalService";
import { ApiError } from "./http";

export const API_ERROR_EVENT = "work-items-api-error";
export const API_UNAUTHORIZED_EVENT = "work-items-api-unauthorized";

const useApi = import.meta.env.VITE_USE_API === "true";
const baseService = useApi ? workItemsApiService : workItemsLocalService;

const reportApiError = (error: unknown): never => {
  if (error instanceof ApiError && error.status === 401) {
    const message = "Please sign in to continue";
    window.dispatchEvent(new CustomEvent(API_UNAUTHORIZED_EVENT, { detail: message }));
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
