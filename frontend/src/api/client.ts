export class ApiError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
const API_KEY = import.meta.env.VITE_API_KEY as string | undefined;

function normalizePath(path: string) {
  if (!path.startsWith("/")) {
    return `/${path}`;
  }
  return path;
}

export async function get<T>(path: string): Promise<T> {
  const url = `${API_BASE_URL}${normalizePath(path)}`;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (API_KEY) {
    headers["X-API-Key"] = API_KEY;
  }
  const res = await fetch(url, { headers });

  if (!res.ok) {
    throw new ApiError(`Request failed with status ${res.status}`, res.status);
  }

  return (await res.json()) as T;
}
