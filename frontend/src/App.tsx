import { useEffect, useState } from "react";
import { fetchHealth, type HealthStatus } from "./health";
import { fetchOpsSummary, type OpsSummary } from "./ops";
import { fetchOpsNext, type OpsNext } from "./ops-next";
import { executeAction, scanFiles, sendChatMessage, type ProposedAction } from "./chat";

const STATUS_LABELS: Record<HealthStatus["status"], string> = {
  ok: "Online",
  error: "Unreachable",
  unknown: "Unknown",
};

export default function App() {
  const [health, setHealth] = useState<HealthStatus>({
    status: "unknown",
    checkedAt: new Date().toISOString(),
  });
  const [ops, setOps] = useState<OpsSummary | null>(null);
  const [opsNext, setOpsNext] = useState<OpsNext | null>(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<"dark" | "light" | "crt">("dark");
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [input, setInput] = useState("");
  const [actions, setActions] = useState<ProposedAction[]>([]);
  const [activity, setActivity] = useState<string[]>([]);
  const [scanSummary, setScanSummary] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const check = async () => {
      setLoading(true);
      const result = await fetchHealth();
      const summary = await fetchOpsSummary();
      const next = await fetchOpsNext();
      if (active) {
        setHealth(result);
        setOps(summary);
        setOpsNext(next);
        setLoading(false);
      }
    };
    void check();
    const interval = setInterval(check, 10_000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem("mage_theme");
    if (stored === "light" || stored === "dark" || stored === "crt") {
      setTheme(stored);
    }
  }, []);

  useEffect(() => {
    document.body.dataset.theme = theme;
    localStorage.setItem("mage_theme", theme);
  }, [theme]);

  return (
    <main className="shell">
      <section className="card">
        <header>
          <div className="header-row">
            <div>
              <p className="eyebrow">MAGE</p>
              <h1>Local-first AI Productivity</h1>
              <p className="subtitle">
                Backend health is checked every 10 seconds from the desktop shell.
              </p>
            </div>
            <div className="theme-toggle" role="group" aria-label="Theme toggle">
              <button
                className={theme === "light" ? "active" : ""}
                onClick={() => setTheme("light")}
              >
                Light
              </button>
              <button
                className={theme === "dark" ? "active" : ""}
                onClick={() => setTheme("dark")}
              >
                Dark
              </button>
              <button
                className={theme === "crt" ? "active" : ""}
                onClick={() => setTheme("crt")}
              >
                CRT
              </button>
            </div>
          </div>
        </header>

        <div className={`status status--${health.status}`}>
          <span className="dot" />
          <div>
            <p className="label">API Status</p>
            <p className="value">
              {loading ? "Checking..." : STATUS_LABELS[health.status]}
            </p>
            <p className="meta">Last checked: {new Date(health.checkedAt).toLocaleTimeString()}</p>
          </div>
        </div>

        <section className="panel">
          <h2>Command Center</h2>
          {!ops ? (
            <p className="meta">Loading summary...</p>
          ) : (
            <div className="panel-grid">
              <div className="panel-card">
                <p className="label">Tasks</p>
                <p className="value">{ops.tasks.total}</p>
                <p className="meta">Overdue: {ops.tasks.overdue} · Due 24h: {ops.tasks.due_24h}</p>
              </div>
              <div className="panel-card">
                <p className="label">Blackboard</p>
                <p className="value">{ops.blackboard.total}</p>
                <p className="meta">Overdue: {ops.blackboard.overdue} · Due 24h: {ops.blackboard.due_24h}</p>
              </div>
              <div className="panel-card">
                <p className="label">Recent Alerts</p>
                <p className="value">{ops.notifications.length}</p>
                <ul className="list">
                  {ops.notifications.map((note) => (
                    <li key={note.id}>
                      {note.title} · {note.status}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </section>

        <section className="panel">
          <h2>Next Best Action</h2>
          {!opsNext ? (
            <p className="meta">Loading next action...</p>
          ) : (
            <div className="panel-grid">
              <div className="panel-card">
                <p className="label">Next</p>
                {opsNext.next ? (
                  <>
                    <p className="value">{opsNext.next.title}</p>
                    <p className="meta">
                      {opsNext.next.urgency} · {opsNext.next.source}
                    </p>
                    <p className="meta">{opsNext.next.reason}</p>
                  </>
                ) : (
                  <p className="meta">No tasks yet.</p>
                )}
              </div>
              <div className="panel-card">
                <p className="label">Alternates</p>
                <ul className="list">
                  {opsNext.alternates.map((alt) => (
                    <li key={alt.id}>
                      {alt.title} · {alt.urgency}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </section>

        <section className="panel">
          <h2>Local Brain Chat</h2>
          <div className="chat-grid">
            <div className="chat-column">
              <div className="chat-window">
                {messages.length === 0 ? (
                  <p className="meta">Start a conversation to see responses.</p>
                ) : (
                  messages.map((msg, idx) => (
                    <div key={idx} className={`chat-bubble ${msg.role}`}>
                      <span className="chat-role">{msg.role}</span>
                      <p>{msg.content}</p>
                    </div>
                  ))
                )}
              </div>
              <form
                className="chat-input"
                onSubmit={async (event) => {
                  event.preventDefault();
                  if (!input.trim()) return;
                  const nextMessage = input.trim();
                  setMessages((prev) => [...prev, { role: "user", content: nextMessage }]);
                  setInput("");
                  try {
                    const response = await sendChatMessage(nextMessage, sessionId ?? undefined);
                    setSessionId(response.session_id);
                    setMessages((prev) => [
                      ...prev,
                      { role: "assistant", content: response.assistant_message },
                    ]);
                    setActions((prev) => [...prev, ...response.proposed_actions]);
                  } catch (err) {
                    setActivity((prev) => [
                      ...prev,
                      "Chat error: failed to reach backend.",
                    ]);
                  }
                }}
              >
                <input
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="Ask MAGE to summarize, create a task, or send a notification..."
                />
                <button type="submit">Send</button>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const result = await scanFiles();
                      setScanSummary(
                        `Scanned ${result.scanned} files · ${result.due_signals.length} due signals · ${result.proposed_tasks.length} proposed tasks`
                      );
                      setActivity((prev) => [
                        ...prev,
                        `Scan complete: ${result.scanned} files`,
                      ]);
                    } catch (err) {
                      setActivity((prev) => [...prev, "Scan failed."]);
                    }
                  }}
                >
                  Scan
                </button>
              </form>
              {scanSummary ? <p className="meta">{scanSummary}</p> : null}
            </div>

            <div className="chat-column">
              <div className="panel-card">
                <p className="label">Proposed Actions</p>
                {actions.length === 0 ? (
                  <p className="meta">No proposed actions yet.</p>
                ) : (
                  <ul className="list">
                    {actions.map((action) => (
                      <li key={action.id}>
                        <strong>{action.tool_name}</strong>
                        <div className="meta">Status: {action.status}</div>
                        <div className="action-buttons">
                          <button
                            onClick={async () => {
                              const result = await executeAction(action.id, true);
                              setActivity((prev) => [
                                ...prev,
                                `Executed ${action.tool_name}: ${result.status}`,
                              ]);
                              setActions((prev) =>
                                prev.map((item) =>
                                  item.id === action.id ? { ...item, status: result.status } : item
                                )
                              );
                            }}
                          >
                            Approve
                          </button>
                          <button
                            onClick={async () => {
                              const result = await executeAction(action.id, false);
                              setActivity((prev) => [
                                ...prev,
                                `Rejected ${action.tool_name}: ${result.status}`,
                              ]);
                              setActions((prev) =>
                                prev.map((item) =>
                                  item.id === action.id ? { ...item, status: result.status } : item
                                )
                              );
                            }}
                          >
                            Reject
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="panel-card">
                <p className="label">Activity Log</p>
                {activity.length === 0 ? (
                  <p className="meta">No activity yet.</p>
                ) : (
                  <ul className="list">
                    {activity.slice(-5).map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
