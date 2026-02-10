import { get, type ApiError } from "./api/client";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ProposedAction = {
  id: number;
  tool_name: string;
  input: Record<string, unknown>;
  status: string;
};

export type ChatResponse = {
  session_id: number;
  assistant_message: string;
  proposed_actions: ProposedAction[];
};

export type ExecuteActionResponse = {
  status: string;
  result?: Record<string, unknown>;
  message?: string;
  tool_run_id?: number;
};

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export async function sendChatMessage(
  message: string,
  sessionId?: number
): Promise<ChatResponse> {
  const res = await fetch(`${API_BASE_URL}/chat/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, session_id: sessionId ?? null }),
  });
  if (!res.ok) {
    throw new Error(`Chat request failed: ${res.status}`);
  }
  return (await res.json()) as ChatResponse;
}

export async function executeAction(
  toolRunId: number,
  approved: boolean
): Promise<ExecuteActionResponse> {
  const res = await fetch(`${API_BASE_URL}/actions/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tool_run_id: toolRunId, approved }),
  });
  if (!res.ok) {
    throw new Error(`Execute failed: ${res.status}`);
  }
  return (await res.json()) as ExecuteActionResponse;
}
