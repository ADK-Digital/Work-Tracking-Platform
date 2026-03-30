export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const isAbsoluteHttpUrl = (value: string): boolean => /^https?:\/\//i.test(value);
const trimToUndefined = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const configuredApiBaseUrl = trimToUndefined(import.meta.env.VITE_API_BASE_URL);

// Keep API_BASE_URL origin-safe for link composition usages elsewhere in the app.
export const API_BASE_URL =
  configuredApiBaseUrl && isAbsoluteHttpUrl(configuredApiBaseUrl)
    ? configuredApiBaseUrl
    : window.location.origin;

const buildRelativeApiPath = (basePath: string, requestPath: string): string => {
  const normalizedBasePath = basePath.startsWith("/") ? basePath : `/${basePath}`;
  const normalizedRequestPath = requestPath.startsWith("/") ? requestPath : `/${requestPath}`;

  if (
    normalizedRequestPath === normalizedBasePath ||
    normalizedRequestPath.startsWith(`${normalizedBasePath}/`)
  ) {
    return normalizedRequestPath;
  }

  const strippedBasePath = normalizedBasePath.replace(/\/$/, "");
  return `${strippedBasePath}${normalizedRequestPath}`;
};

const buildUrl = (path: string, query?: Record<string, string | number | boolean | undefined>): string => {
  const url = configuredApiBaseUrl
    ? isAbsoluteHttpUrl(configuredApiBaseUrl)
      ? new URL(path, configuredApiBaseUrl)
      : new URL(buildRelativeApiPath(configuredApiBaseUrl, path), window.location.origin)
    : new URL(path, window.location.origin);

  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    });
  }

  return url.toString();
};

export const apiFetch = async <T>(
  path: string,
  options: RequestInit & { query?: Record<string, string | number | boolean | undefined> } = {}
): Promise<T> => {
  const { query, headers, ...fetchOptions } = options;
  const computedHeaders: Record<string, string> = {
    ...(headers as Record<string, string> | undefined)
  };

  if (!(fetchOptions.body instanceof FormData) && !computedHeaders["Content-Type"]) {
    computedHeaders["Content-Type"] = "application/json";
  }

  const response = await fetch(buildUrl(path, query), {
    ...fetchOptions,
    credentials: "include",
    headers: computedHeaders
  });

  if (!response.ok) {
    let message = response.statusText;

    try {
      const payload = (await response.json()) as { error?: string; message?: string };
      message = payload.error ?? payload.message ?? message;
    } catch {
      // no-op, keep status text
    }

    throw new ApiError(response.status, `API ${response.status}: ${message}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  return (text ? (JSON.parse(text) as T) : undefined) as T;
};
