const API_URL = (
  import.meta.env.VITE_API_URL ?? "http://localhost:3000"
).replace(/\/+$/, "");

// Thrown for any non-2xx response. `data` holds the parsed JSON body (or
// null), so callers can read backend validation details. Never show
// `message` or `data` to users as-is: build a friendly message instead.
export class ApiError extends Error {
  readonly status: number;
  readonly data: unknown;

  constructor(status: number, statusText: string, data: unknown) {
    super(`API request failed: ${status} ${statusText}`);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

export async function apiRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(
    `${API_URL}/${path.replace(/^\/+/, "")}`,
    {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...init?.headers,
      },
    },
  );

  if (!response.ok) {
    // The body may be missing or not JSON, so fall back to null.
    const data: unknown = await response.json().catch(() => null);
    throw new ApiError(response.status, response.statusText, data);
  }

  return (await response.json()) as T;
}
