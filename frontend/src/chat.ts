const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
const API_KEY = import.meta.env.VITE_API_KEY as string | undefined;

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  route_to?: string;
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
  route_to: string;
  proposed_actions: ProposedAction[];
};

export type ExecuteActionResponse = {
  status: string;
  result?: Record<string, unknown>;
  message?: string;
  tool_run_id?: number;
};

export type FileScanResponse = {
  scanned: number;
  hot_files: Array<Record<string, unknown>>;
  due_signals: Array<Record<string, unknown>>;
  stale_candidates: Array<Record<string, unknown>>;
  junk_candidates: Array<Record<string, unknown>>;
  proposed_tasks: Array<Record<string, unknown>>;
};

export type IngestTask = {
  title: string;
  summary: string;
  due_date: string | null;
  priority: "low" | "medium" | "high" | "critical";
  source: "email" | "web";
};

export type IngestResponse = {
  source: "email" | "web";
  summary: string;
  due_date: string | null;
  priority: "low" | "medium" | "high" | "critical";
  proposed_tasks: IngestTask[];
  dry_run: boolean;
};

export type EmailFetchResponse = {
  source: "email";
  count: number;
  mailbox: string;
  dry_run: boolean;
  items: Array<{
    uid: string;
    subject: string;
    from_email: string | null;
    received_at: string | null;
    summary: string;
    priority: "low" | "medium" | "high" | "critical";
    due_date: string | null;
    proposed_tasks: IngestTask[];
  }>;
};

function buildHeaders() {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (API_KEY) {
    headers["X-API-Key"] = API_KEY;
  }
  return headers;
}

export async function sendChatMessage(
  message: string,
  sessionId?: number
): Promise<ChatResponse> {
  const res = await fetch(`${API_BASE_URL}/chat/message`, {
    method: "POST",
    headers: buildHeaders(),
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
    headers: buildHeaders(),
    body: JSON.stringify({ tool_run_id: toolRunId, approved }),
  });
  if (!res.ok) {
    throw new Error(`Execute failed: ${res.status}`);
  }
  return (await res.json()) as ExecuteActionResponse;
}

export async function scanFiles(paths: string[] = ["~/Desktop"]): Promise<FileScanResponse> {
  const res = await fetch(`${API_BASE_URL}/tools/files/scan`, {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify({
      mode: "scoped",
      paths,
      options: {
        include_exts: ["pdf", "docx", "md", "txt", "pptx", "xlsx", "py", "js", "ts", "tsx"],
        exclude_dirs: ["node_modules", ".git", ".venv", "dist", "build", "__pycache__"],
        max_file_mb: 2,
        read_text: true,
        max_chars: 12000,
      },
    }),
  });
  if (!res.ok) {
    throw new Error(`Scan failed: ${res.status}`);
  }
  return (await res.json()) as FileScanResponse;
}

export async function ingestWeb(url: string): Promise<IngestResponse> {
  const res = await fetch(`${API_BASE_URL}/ingest/web`, {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify({ url }),
  });
  if (!res.ok) {
    throw new Error(`Web ingest failed: ${res.status}`);
  }
  return (await res.json()) as IngestResponse;
}

export async function ingestEmail(subject: string, body: string): Promise<IngestResponse> {
  const res = await fetch(`${API_BASE_URL}/ingest/email`, {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify({ subject, body }),
  });
  if (!res.ok) {
    throw new Error(`Email ingest failed: ${res.status}`);
  }
  return (await res.json()) as IngestResponse;
}

export async function ingestEmailFetch(limit = 5, mailbox = "INBOX"): Promise<EmailFetchResponse> {
  const res = await fetch(`${API_BASE_URL}/ingest/email/fetch`, {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify({ limit, mailbox }),
  });
  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(errorBody || `Email fetch failed: ${res.status}`);
  }
  return (await res.json()) as EmailFetchResponse;
}
