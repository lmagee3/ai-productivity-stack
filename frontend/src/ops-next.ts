import { get } from "./api/client";

export type OpsNext = {
  next: {
    id: string;
    title: string;
    source: string;
    due_at: string | null;
    urgency: string;
    reason: string;
  } | null;
  alternates: Array<{
    id: string;
    title: string;
    source: string;
    due_at: string | null;
    urgency: string;
    reason: string;
  }>;
};

export async function fetchOpsNext(): Promise<OpsNext> {
  return get<OpsNext>("/ops/next");
}
