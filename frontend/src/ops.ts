import { get } from "./api/client";

export type OpsSummary = {
  timestamp: string;
  tasks: {
    total: number;
    overdue: number;
    due_24h: number;
  };
  blackboard: {
    total: number;
    overdue: number;
    due_24h: number;
  };
  notifications: Array<{
    id: number;
    provider: string;
    title: string;
    status: string;
    created_at: string | null;
  }>;
};

export async function fetchOpsSummary(): Promise<OpsSummary> {
  return get<OpsSummary>("/ops/summary");
}
