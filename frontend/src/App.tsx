import { useEffect, useMemo, useState } from "react";
import { fetchHealth, type HealthStatus } from "./health";
import { fetchOpsSummary, type OpsSummary } from "./ops";
import { fetchOpsNext, type OpsNext } from "./ops-next";
import { executeAction, scanFiles, sendChatMessage, type ProposedAction } from "./chat";

type ViewMode = "mission" | "brief";
type MissionTab = "overview" | "sprint" | "timeline" | "all";
type NewsTab = "markets" | "geopolitics" | "tech" | "science" | "culture";

type BriefTask = {
  id: string;
  title: string;
  meta: string;
  urgency: "critical" | "today" | "tomorrow" | "week" | "later";
  badge: string;
};

const STATUS_LABELS: Record<HealthStatus["status"], string> = {
  ok: "Online",
  error: "Unreachable",
  unknown: "Unknown",
};

const NEWS: Record<NewsTab, Array<{ title: string; body: string; tone?: "up" | "down" | "alert" }>> = {
  markets: [
    { title: "Market Pulse", body: "Broad risk appetite steady. Keep an eye on earnings and macro prints.", tone: "up" },
    { title: "Rates Watch", body: "Treasury curve flat; short-end sensitive to data surprises." },
    { title: "Energy", body: "Crude range-bound; inventories tighten into late winter." },
  ],
  geopolitics: [
    { title: "Global Brief", body: "Maintain awareness of regional flashpoints and supply chain risk.", tone: "alert" },
    { title: "Policy", body: "Expect elevated noise around election-year positioning." },
  ],
  tech: [
    { title: "AI Platforms", body: "Model competition accelerating; focus on local-first reliability." },
    { title: "Security", body: "High scrutiny on data handling and privacy guarantees." },
  ],
  science: [
    { title: "Research Pulse", body: "Incremental gains in biotech and materials science." },
    { title: "Space", body: "Launch cadence remains high across commercial providers." },
  ],
  culture: [
    { title: "Cultural Radar", body: "Attention cycles remain short; clarity beats noise." },
  ],
};

const scanTriggers = /scan|files|file|folder|desktop|check my stuff|check my files|look through/i;

const isTauri = () => typeof (window as any).__TAURI__ !== "undefined";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString();
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return "No date";
  const date = new Date(iso);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function urgencyLabel(urgency: string | null | undefined) {
  if (!urgency) return "later";
  return urgency;
}

function badgeForSource(source?: string | null) {
  if (!source) return "Manual";
  if (source === "blackboard") return "School";
  if (source === "files") return "Files";
  return source.charAt(0).toUpperCase() + source.slice(1);
}

export default function App() {
  const [viewMode, setViewMode] = useState<ViewMode>("mission");
  const [missionTab, setMissionTab] = useState<MissionTab>("overview");
  const [newsTab, setNewsTab] = useState<NewsTab>("markets");
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
  const [showScanModal, setShowScanModal] = useState(false);
  const [briefChecks, setBriefChecks] = useState<Record<string, boolean>>({});

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
    const stored = localStorage.getItem("module_09_theme");
    if (stored === "light" || stored === "dark" || stored === "crt") {
      setTheme(stored);
    }
  }, []);

  useEffect(() => {
    document.body.dataset.theme = theme;
    localStorage.setItem("module_09_theme", theme);
  }, [theme]);

  useEffect(() => {
    const stored: Record<string, boolean> = {};
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith("brief_task_")) {
        stored[key.replace("brief_task_", "")] = localStorage.getItem(key) === "done";
      }
    });
    setBriefChecks(stored);
  }, []);

  const attackOrder = useMemo(() => {
    if (!opsNext?.next) return [];
    return [opsNext.next, ...opsNext.alternates];
  }, [opsNext]);

  const briefTasks = useMemo<BriefTask[]>(() => {
    return attackOrder.map((task) => ({
      id: task.id,
      title: task.title,
      meta: task.reason ?? "Scheduled",
      urgency: (task.urgency as BriefTask["urgency"]) ?? "later",
      badge: badgeForSource(task.source),
    }));
  }, [attackOrder]);

  const briefGroups = useMemo(() => {
    const groups: Record<BriefTask["urgency"], BriefTask[]> = {
      critical: [],
      today: [],
      tomorrow: [],
      week: [],
      later: [],
    };
    briefTasks.forEach((task) => {
      groups[task.urgency] = [...groups[task.urgency], task];
    });
    return groups;
  }, [briefTasks]);

  const toggleBriefTask = (taskId: string) => {
    const nextValue = !(briefChecks[taskId] ?? false);
    const updated = { ...briefChecks, [taskId]: nextValue };
    setBriefChecks(updated);
    localStorage.setItem(`brief_task_${taskId}`, nextValue ? "done" : "");
  };

  const formatList = (items: Array<{ path?: string; title?: string }>) => {
    if (!items || items.length === 0) return "none";
    return items
      .slice(0, 4)
      .map((item) => item.path || item.title || "")
      .filter(Boolean)
      .join(" · ");
  };

  const handleScan = async (trigger: "auto" | "button", paths: string[] = ["~/Desktop"]) => {
  const openPicker = async (mode: "files" | "folders") => {
    if (!isTauri()) {
      setActivity((prev) => [...prev, "File picker is available in the desktop app only."]);
      return;
    }
    try {
      const dialog = await import("@tauri-apps/api/dialog");
      const selection = await dialog.open({
        multiple: true,
        directory: mode === "folders",
        title: mode === "folders" ? "Choose folders to scan" : "Choose files to scan",
      });
      if (!selection) {
        return;
      }
      const paths = Array.isArray(selection) ? selection : [selection];
      await handleScan("button", paths);
    } catch (err) {
      setActivity((prev) => [...prev, "File picker failed."]);
    }
  };

    try {
      const result = await scanFiles(paths);
      setScanSummary(
        `Scanned ${result.scanned} files · ${result.due_signals.length} due signals · ${result.proposed_tasks.length} proposed tasks`
      );

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: [
            "Scan results:",
            `🔥 Due Signals: ${formatList(result.due_signals as Array<{ path?: string; title?: string }>)}${
              result.due_signals.length > 4 ? " …" : ""
            }`,
            `📌 Proposed Tasks: ${formatList(result.proposed_tasks as Array<{ path?: string; title?: string }>)}${
              result.proposed_tasks.length > 4 ? " …" : ""
            }`,
            `🗂 Hot Files: ${formatList(result.hot_files as Array<{ path?: string; title?: string }>)}${
              result.hot_files.length > 4 ? " …" : ""
            }`,
            `🧹 Stale/Junk: ${formatList([
              ...(result.stale_candidates as Array<{ path?: string; title?: string }>),
              ...(result.junk_candidates as Array<{ path?: string; title?: string }>),
            ])}${
              result.stale_candidates.length + result.junk_candidates.length > 4 ? " …" : ""
            }`,
          ].join("\n"),
        },
      ]);

      setActivity((prev) => [...prev, `Scan ${trigger}: ${result.scanned} files`]);
    } catch (err) {
      setActivity((prev) => [...prev, "Scan failed."]);
    }
  };

  const handleChatSubmit = async () => {
    if (!input.trim()) return;
    const nextMessage = input.trim();
    const wantsScan = scanTriggers.test(nextMessage);
    setMessages((prev) => [...prev, { role: "user", content: nextMessage }]);
    setInput("");
    if (wantsScan) {
      void handleScan("auto");
    }
    try {
      const response = await sendChatMessage(nextMessage, sessionId ?? undefined);
      setSessionId(response.session_id);
      setMessages((prev) => [...prev, { role: "assistant", content: response.assistant_message }]);
      setActions((prev) => [...prev, ...response.proposed_actions]);
    } catch (err) {
      setActivity((prev) => [...prev, "Chat error: failed to reach backend."]);
    }
  };

  const totalTasks = ops?.tasks.total ?? 0;
  const overdueTasks = ops?.tasks.overdue ?? 0;
  const dueSoonTasks = ops?.tasks.due_24h ?? 0;
  const blackboardTotal = ops?.blackboard.total ?? 0;
  const notificationsTotal = ops?.notifications.length ?? 0;

  const briefDone = briefTasks.filter((task) => briefChecks[task.id]).length;
  const briefTotal = briefTasks.length;
  const briefRemaining = briefTotal - briefDone;
  const briefPct = briefTotal === 0 ? 0 : Math.round((briefDone / briefTotal) * 100);

  return (
    <main className="module-shell">
      <div className="app">
        <div className="header">
          <div>
            <h1>◔ Mission Control</h1>
            <div className="header-sub">
              Local-first command center · {new Date().toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
            </div>
          </div>
          <div className="header-actions">
            <div className="view-toggle" role="group" aria-label="View toggle">
              <button
                className={viewMode === "mission" ? "active" : ""}
                onClick={() => setViewMode("mission")}
              >
                Mission Control
              </button>
              <button
                className={viewMode === "brief" ? "active" : ""}
                onClick={() => setViewMode("brief")}
              >
                Daily Brief
              </button>
            </div>
            <div className="theme-toggle" role="group" aria-label="Theme toggle">
              <button className={theme === "light" ? "active" : ""} onClick={() => setTheme("light")}>
                Light
              </button>
              <button className={theme === "dark" ? "active" : ""} onClick={() => setTheme("dark")}>
                Dark
              </button>
              <button className={theme === "crt" ? "active" : ""} onClick={() => setTheme("crt")}>
                CRT
              </button>
            </div>
          </div>
        </div>

        {viewMode === "mission" ? (
          <>
            <div className="status">
              <span className={`status-dot status-${health.status}`} />
              <div>
                <div className="label">API Status</div>
                <div className="value">{loading ? "Checking..." : STATUS_LABELS[health.status]}</div>
                <div className="meta">Last checked: {formatTime(health.checkedAt)}</div>
              </div>
            </div>

            {(overdueTasks > 0 || dueSoonTasks > 0) && (
              <div className={`alert ${overdueTasks > 0 ? "alert-red" : "alert-yellow"}`}>
                <span className="alert-icon">&#9888;</span>
                <div>
                  {overdueTasks > 0 && (
                    <strong>{overdueTasks} overdue task{overdueTasks === 1 ? "" : "s"}.</strong>
                  )}{" "}
                  {dueSoonTasks > 0 && (
                    <strong>{dueSoonTasks} due within 24h.</strong>
                  )}
                  <span className="alert-note"> Focus on these first.</span>
                </div>
              </div>
            )}

            <div className="nav">
              {(["overview", "sprint", "timeline", "all"] as MissionTab[]).map((tab) => (
                <button
                  key={tab}
                  className={`nav-btn ${missionTab === tab ? "active" : ""}`}
                  onClick={() => setMissionTab(tab)}
                >
                  {tab === "overview" ? "Overview" : tab === "sprint" ? "Sprint" : tab === "timeline" ? "Timeline" : "All Tasks"}
                </button>
              ))}
            </div>

            {missionTab === "overview" && (
              <div className="view-panel">
                <div className="metrics">
                  <div className="metric-card">
                    <div className="mc-top">
                      <div className="mc-icon green">&#10003;</div>
                      <div>
                        <div className="mc-val">{totalTasks}</div>
                        <div className="mc-label">Total Tasks</div>
                        <div className="mc-sub">Across all sources</div>
                      </div>
                    </div>
                  </div>
                  <div className="metric-card">
                    <div className="mc-top">
                      <div className="mc-icon red">&#9888;</div>
                      <div>
                        <div className="mc-val">{overdueTasks}</div>
                        <div className="mc-label">Overdue</div>
                        <div className="mc-sub">Immediate attention</div>
                      </div>
                    </div>
                  </div>
                  <div className="metric-card">
                    <div className="mc-top">
                      <div className="mc-icon yellow">&#9889;</div>
                      <div>
                        <div className="mc-val">{dueSoonTasks}</div>
                        <div className="mc-label">Due 24h</div>
                        <div className="mc-sub">Upcoming deadlines</div>
                      </div>
                    </div>
                  </div>
                  <div className="metric-card">
                    <div className="mc-top">
                      <div className="mc-icon blue">&#128214;</div>
                      <div>
                        <div className="mc-val">{blackboardTotal}</div>
                        <div className="mc-label">Blackboard</div>
                        <div className="mc-sub">Assignments tracked</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="charts-row">
                  <div className="chart-card">
                    <h3>By Status</h3>
                    <div className="chart-wrap">
                      <div className="chart-placeholder">No chart data yet</div>
                    </div>
                  </div>
                  <div className="chart-card">
                    <h3>By Source</h3>
                    <div className="chart-wrap">
                      <div className="chart-placeholder">Awaiting more data</div>
                    </div>
                  </div>
                  <div className="chart-card">
                    <h3>Focus Load</h3>
                    <div className="chart-wrap">
                      <div className="chart-placeholder">Sync more tasks to unlock</div>
                    </div>
                  </div>
                </div>

                <div className="section-card">
                  <div className="section-header">
                    <span className="sh-icon">&#9889;</span>
                    <h3>Attack Order — What to Tackle First</h3>
                  </div>
                  {attackOrder.length === 0 ? (
                    <p className="meta">No tasks available yet.</p>
                  ) : (
                    <div className="sug-list">
                      {attackOrder.map((task, idx) => (
                        <div key={task.id} className="sug-item">
                          <div className={`sug-rank r${Math.min(idx + 1, 3)}`}>{idx + 1}</div>
                          <div className="sug-body">
                            <div className="sug-name">{task.title}</div>
                            <div className="sug-meta">
                              <span className="domain-tag">{badgeForSource(task.source)}</span>
                              <span className={`badge badge-${task.urgency}`}>{urgencyLabel(task.urgency)}</span>
                              <span className="days-label">{task.due_at ? formatDate(task.due_at) : "No date"}</span>
                            </div>
                            <div className="sug-reason">{task.reason ?? "Scheduled"}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="section-card">
                  <div className="section-header">
                    <span className="sh-icon">&#128736;</span>
                    <h3>Local Brain Chat</h3>
                  </div>
                  <div className="chat-grid">
                    <div className="chat-column">
                      <div className="chat-panel">
                        <div className="chat-panel-header">Conversation</div>
                        <div className="chat-window">
                          {messages.length === 0 ? (
            <p className="meta">Ask module_09 to scan your desktop or plan your next move.</p>
                          ) : (
                            messages.map((msg, idx) => (
                              <div key={idx} className={`chat-bubble ${msg.role}`}>
                                <span className="chat-role">{msg.role}</span>
                                <p>{msg.content}</p>
                              </div>
                            ))
                          )}
                        </div>
                        <div className="chat-actions">
                          <input
                            value={input}
                            onChange={(event) => setInput(event.target.value)}
                          placeholder="Ask module_09 to scan files, summarize, or plan."
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                void handleChatSubmit();
                              }
                            }}
                          />
                          <button onClick={() => void handleChatSubmit()}>Send</button>
                          <button className="ghost" onClick={() => void handleScan("button")}>
                            Scan Desktop
                          </button>
                        </div>
                        {scanSummary ? <div className="chat-meta">{scanSummary}</div> : null}
                      </div>
                    </div>
                    <div className="chat-column">
                      <div className="chat-panel">
                        <div className="chat-panel-header">Proposed Actions</div>
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
                                      setActivity((prev) => [...prev, `Executed ${action.tool_name}: ${result.status}`]);
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
                                      setActivity((prev) => [...prev, `Rejected ${action.tool_name}: ${result.status}`]);
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
                      <div className="chat-panel">
                        <div className="chat-panel-header">Activity Log</div>
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
                </div>
              </div>
            )}


            {showScanModal ? (
              <div className="scan-modal-backdrop">
                <div className="scan-modal">
                  <h3>Scan Options</h3>
                  <p className="meta">Choose what to scan. Desktop is fast, custom lets you pick folders or files (including external drives).</p>
                  <div className="scan-modal-actions">
                    <button onClick={() => {
                      setShowScanModal(false);
                      void handleScan("button", ["~/Desktop"]);
                    }}>Scan Desktop</button>
                    <button className="ghost" onClick={() => openPicker("folders")}>Choose Folders</button>
                    <button className="ghost" onClick={() => openPicker("files")}>Choose Files</button>
                  </div>
                  <button className="scan-modal-cancel" onClick={() => setShowScanModal(false)}>Cancel</button>
                </div>
              </div>
            ) : null}
            {missionTab !== "overview" && (
              <div className="section-card">
                <div className="section-header">
                  <span className="sh-icon">&#128161;</span>
                  <h3>{missionTab === "sprint" ? "Sprint" : missionTab === "timeline" ? "Timeline" : "All Tasks"}</h3>
                </div>
                <p className="meta">This view will populate as more task data is synced.</p>
              </div>
            )}
          </>
        ) : (
          <div className="daily-brief">
            <div className="brief-header">
              <div>
                <h1>DAILY BRIEF</h1>
                <div className="brief-date">
                  {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                </div>
              </div>
              <div className="brief-greeting">Good morning. Your battle plan is locked.</div>
            </div>

            <div className="brief-stats">
              <div className="stat">
                <div className="num">{briefDone}/{briefTotal}</div>
                <div className="label">Complete</div>
              </div>
              <div className="stat">
                <div className="num">{briefPct}%</div>
                <div className="label">Progress</div>
              </div>
              <div className="stat">
                <div className="num">{briefRemaining}</div>
                <div className="label">Remaining</div>
              </div>
            </div>

            <div className="brief-grid">
              <div className="brief-col">
                <div className="section">
                  <div className="section-title">News Briefing</div>
                  <div className="news-cat">
                    {(["markets", "geopolitics", "tech", "science", "culture"] as NewsTab[]).map((tab) => (
                      <button
                        key={tab}
                        className={`news-tab ${newsTab === tab ? "active" : ""}`}
                        onClick={() => setNewsTab(tab)}
                      >
                        {tab === "tech" ? "Tech & AI" : tab.charAt(0).toUpperCase() + tab.slice(1)}
                      </button>
                    ))}
                  </div>
                  <div className="news-section active">
                    {NEWS[newsTab].map((item, idx) => (
                      <div
                        key={idx}
                        className={`news-item ${item.tone === "up" ? "tone-up" : item.tone === "alert" ? "tone-alert" : item.tone === "down" ? "tone-down" : ""}`}
                      >
                        <h3>{item.title}</h3>
                        <p>{item.body}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="brief-col">
                <div className="section">
                  <div className="section-title">Today&#39;s Attack Order</div>
                  {(briefGroups.critical.length === 0 && briefGroups.today.length === 0) ? (
                    <p className="meta">No critical or today tasks yet.</p>
                  ) : (
                    <>
                      {briefGroups.critical.map((task) => (
                        <div
                          key={task.id}
                          className={`task priority-critical ${briefChecks[task.id] ? "checked" : ""}`}
                          onClick={() => toggleBriefTask(task.id)}
                        >
                          <input type="checkbox" checked={briefChecks[task.id] ?? false} readOnly />
                          <div>
                            <div className="task-name">
                              {task.title}
                              <span className="badge badge-source">{task.badge}</span>
                            </div>
                            <div className="task-meta">{task.meta}</div>
                          </div>
                        </div>
                      ))}
                      {briefGroups.today.map((task) => (
                        <div
                          key={task.id}
                          className={`task priority-high ${briefChecks[task.id] ? "checked" : ""}`}
                          onClick={() => toggleBriefTask(task.id)}
                        >
                          <input type="checkbox" checked={briefChecks[task.id] ?? false} readOnly />
                          <div>
                            <div className="task-name">
                              {task.title}
                              <span className="badge badge-source">{task.badge}</span>
                            </div>
                            <div className="task-meta">{task.meta}</div>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>

                <div className="section">
                  <div className="section-title">Tomorrow</div>
                  {briefGroups.tomorrow.length === 0 ? (
                    <p className="meta">No tasks due tomorrow.</p>
                  ) : (
                    briefGroups.tomorrow.map((task) => (
                      <div
                        key={task.id}
                        className={`task priority-med ${briefChecks[task.id] ? "checked" : ""}`}
                        onClick={() => toggleBriefTask(task.id)}
                      >
                        <input type="checkbox" checked={briefChecks[task.id] ?? false} readOnly />
                        <div>
                          <div className="task-name">
                            {task.title}
                            <span className="badge badge-source">{task.badge}</span>
                          </div>
                          <div className="task-meta">{task.meta}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="section">
                  <div className="section-title">This Week</div>
                  {briefGroups.week.length === 0 ? (
                    <p className="meta">No tasks due this week.</p>
                  ) : (
                    briefGroups.week.map((task) => (
                      <div
                        key={task.id}
                        className={`task priority-low ${briefChecks[task.id] ? "checked" : ""}`}
                        onClick={() => toggleBriefTask(task.id)}
                      >
                        <input type="checkbox" checked={briefChecks[task.id] ?? false} readOnly />
                        <div>
                          <div className="task-name">
                            {task.title}
                            <span className="badge badge-source">{task.badge}</span>
                          </div>
                          <div className="task-meta">{task.meta}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <button className="report-btn">Generate End-of-Day Report</button>
              </div>
            </div>

            <div className="brief-footer">module_09 Daily Brief · Generated {new Date().toLocaleDateString()}</div>
          </div>
        )}
      </div>
    </main>
  );
}
