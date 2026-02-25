export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001";

const buildUrl = (path: string, query?: Record<string, string | number | boolean | undefined>): string => {
  const url = new URL(path, API_BASE_URL);

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
  const response = await fetch(buildUrl(path, query), {
    ...fetchOptions,
    headers: {
      "Content-Type": "application/json",
      ...headers
    }
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
