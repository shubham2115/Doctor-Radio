export class ApiError extends Error {
  constructor(message: string, public status: number, public fieldErrors?: Record<string, string[]>) {
    super(message);
  }
}

/** Thin fetch wrapper for our JSON REST API. Throws ApiError with field-level errors for 422. */
export async function api<T = unknown>(url: string, method: "POST" | "PUT" | "PATCH" | "DELETE", body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error ?? "Request failed", res.status, data.fieldErrors);
  return data as T;
}
