/**
 * Type-safe native fetch wrapper for backend API endpoints.
 * Strictly adheres to Next.js 14 conventions without third-party HTTP clients.
 */

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${BASE_URL.replace(/\/$/, "")}/${endpoint.replace(/^\//, "")}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options?.headers as Record<string, string>) || {}),
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API error (${response.status}): ${errorText || response.statusText}`);
  }

  return (await response.json()) as T;
}

export const api = {
  get: <T>(endpoint: string, options?: RequestInit): Promise<T> =>
    fetchApi<T>(endpoint, { ...options, method: "GET" }),
  post: <T>(endpoint: string, body?: unknown, options?: RequestInit): Promise<T> =>
    fetchApi<T>(endpoint, {
      ...options,
      method: "POST",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  put: <T>(endpoint: string, body?: unknown, options?: RequestInit): Promise<T> =>
    fetchApi<T>(endpoint, {
      ...options,
      method: "PUT",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  delete: <T>(endpoint: string, options?: RequestInit): Promise<T> =>
    fetchApi<T>(endpoint, { ...options, method: "DELETE" }),
};
