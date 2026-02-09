import { get } from "./api/client";

export type HealthStatus = {
  status: "ok" | "error" | "unknown";
  checkedAt: string;
};

export async function fetchHealth(): Promise<HealthStatus> {
  try {
    const data = await get<{ status?: string }>("/health");
    return {
      status: data.status === "ok" ? "ok" : "error",
      checkedAt: new Date().toISOString(),
    };
  } catch {
    return { status: "error", checkedAt: new Date().toISOString() };
  }
}
