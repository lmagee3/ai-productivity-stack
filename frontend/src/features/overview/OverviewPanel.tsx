import React, { useMemo, useState } from 'react';
import type { ProposedAction } from '../../chat';

type OverviewPrefs = {
  metrics: boolean;
  charts: boolean;
  attack: boolean;
  chat: boolean;
};

type OpsNextItem = {
  id: string;
  title: string;
  source: string;
  due_at: string | null;
  urgency: string;
  reason: string;
};

type ScanResult = {
  due: Array<{ summary: string; priority: 'critical' | 'high' | 'medium' | 'low' }>;
  tasks: Array<{ summary: string; priority: 'critical' | 'high' | 'medium' | 'low' }>;
  hot: string[];
  stale: string[];
  junk: string[];
} | null;

type Props = {
  prefs: OverviewPrefs;
  totalTasks: number;
  overdueTasks: number;
  dueSoonTasks: number;
  blackboardTotal: number;
  attackOrder: OpsNextItem[];
  scanResult: ScanResult;
  messages: Array<{ role: 'user' | 'assistant'; content: string; route_to?: string }>;
  actions: ProposedAction[];
  activity: string[];
  scanSummary: string | null;
  isScanning: boolean;
  scanElapsedS: number;
  onSendChat: () => void;
  onOpenScan: () => void;
  onRunScan: () => void;
  onSyncInbox: () => void;
  onRefreshHeadlines: () => void;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
  input: string;
  onInputChange: (value: string) => void;
};

export function OverviewPanel({
  prefs,
  totalTasks,
  overdueTasks,
  dueSoonTasks,
  blackboardTotal,
  attackOrder,
  scanResult,
  messages,
  actions,
  activity,
  scanSummary,
  isScanning,
  scanElapsedS,
  onSendChat,
  onOpenScan,
  onRunScan,
  onSyncInbox,
  onRefreshHeadlines,
  onApprove,
  onReject,
  input,
  onInputChange,
}: Props) {
  const [showAllAttack, setShowAllAttack] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<string>("all");

  const routeLabel = (route?: string) => {
    if (!route) return null;
    if (route === "local_fast") return "FAST";
    if (route === "local_deep") return "DEEP";
    if (route === "cloud_pending_approval") return "CLOUD PENDING APPROVAL";
    if (route === "tool") return "TOOL";
    return route.toUpperCase();
  };

  const attackSources = useMemo(() => {
    const uniq = Array.from(new Set(attackOrder.map((task) => task.source).filter(Boolean)));
    return ["all", ...uniq];
  }, [attackOrder]);

  const domainClass = (source: string) => {
    const value = source.toLowerCase();
    if (value.includes("kairos")) return "domain-tag domain-kairos";
    if (value.includes("school")) return "domain-tag domain-school";
    if (value.includes("job")) return "domain-tag domain-jobsearch";
    if (value.includes("personal")) return "domain-tag domain-personal";
    if (value.includes("email")) return "domain-tag domain-email";
    if (value.includes("web")) return "domain-tag domain-web";
    if (value.includes("files")) return "domain-tag domain-files";
    return "domain-tag";
  };

  const filteredAttackOrder = useMemo(() => {
    const base = sourceFilter === "all" ? attackOrder : attackOrder.filter((task) => task.source === sourceFilter);
    return showAllAttack ? base : base.slice(0, 5);
  }, [attackOrder, showAllAttack, sourceFilter]);

  return (
    <div className="view-panel">
      {prefs.metrics ? (
        <div className="metrics">
          <div className="metric-card">
            <div className="mc-top">
              <div className="mc-icon green">✓</div>
              <div>
                <div className="mc-val">{totalTasks}</div>
                <div className="mc-label">Total Tasks</div>
                <div className="mc-sub">Across all sources</div>
              </div>
            </div>
          </div>
          <div className="metric-card">
            <div className="mc-top">
              <div className="mc-icon red">⚠</div>
              <div>
                <div className="mc-val">{overdueTasks}</div>
                <div className="mc-label">Overdue</div>
                <div className="mc-sub">Immediate attention</div>
              </div>
            </div>
          </div>
          <div className="metric-card">
            <div className="mc-top">
              <div className="mc-icon yellow">⚡</div>
              <div>
                <div className="mc-val">{dueSoonTasks}</div>
                <div className="mc-label">Due 24h</div>
                <div className="mc-sub">Upcoming deadlines</div>
              </div>
            </div>
          </div>
          <div className="metric-card">
            <div className="mc-top">
              <div className="mc-icon blue">📚</div>
              <div>
                <div className="mc-val">{blackboardTotal}</div>
                <div className="mc-label">Blackboard</div>
                <div className="mc-sub">Assignments tracked</div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {prefs.charts ? (
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
      ) : null}

      {prefs.attack ? (
        <div className="section-card">
          <div className="section-header">
            <span className="sh-icon">⚡</span>
            <h3>Attack Order — What to Tackle First</h3>
          </div>
          <div className="domain-filters">
            {attackSources.map((source) => (
              <button
                key={source}
                className={`df-btn ${sourceFilter === source ? "active" : ""}`}
                onClick={() => setSourceFilter(source)}
              >
                {source === "all" ? "All" : source}
              </button>
            ))}
          </div>
          {attackOrder.length === 0 ? (
            <p className="meta">No tasks available yet.</p>
          ) : (
            <div className="sug-list">
              {filteredAttackOrder.map((task, idx) => (
                <div key={task.id} className="sug-item">
                  <div className={`sug-rank r${Math.min(idx + 1, 3)}`}>{idx + 1}</div>
                  <div className="sug-body">
                    <div className="sug-name">{task.title}</div>
                    <div className="sug-meta">
                      <span className={domainClass(task.source)}>{task.source}</span>
                      <span className={`badge badge-${task.urgency}`}>{task.urgency}</span>
                      <span className="days-label">{task.due_at ?? 'No date'}</span>
                    </div>
                    <div className="sug-reason">{task.reason}</div>
                  </div>
                </div>
              ))}
              {attackOrder.length > 5 ? (
                <button className="show-more" onClick={() => setShowAllAttack((prev) => !prev)}>
                  {showAllAttack ? "Show less" : `Show all ${attackOrder.length} tasks`}
                </button>
              ) : null}
            </div>
          )}
        </div>
      ) : null}

      {scanResult ? (
        <div className="section-card">
          <div className="section-header">
            <span className="sh-icon">📂</span>
            <h3>Scan Signals</h3>
          </div>
          <div className="scan-grid">
            <div>
              <div className="label">Due Signals</div>
              <ul className="list">
                {scanResult.due.slice(0, 5).map((item, idx) => (
                  <li key={`due-${idx}`}>
                    {item.summary}
                    <span className={`badge badge-${item.priority}`}>{item.priority}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="label">Proposed Tasks</div>
              <ul className="list">
                {scanResult.tasks.slice(0, 5).map((item, idx) => (
                  <li key={`task-${idx}`}>
                    {item.summary}
                    <span className={`badge badge-${item.priority}`}>{item.priority}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="label">Hot Files</div>
              <ul className="list">
                {scanResult.hot.slice(0, 5).map((item, idx) => (
                  <li key={`hot-${idx}`}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <div className="label">Stale/Junk</div>
              <ul className="list">
                {scanResult.stale.concat(scanResult.junk).slice(0, 5).map((item, idx) => (
                  <li key={`stale-${idx}`}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : null}

      {prefs.chat ? (
        <div className="section-card">
          <div className="section-header">
            <span className="sh-icon">🛠</span>
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
                        {msg.role === 'assistant' && msg.route_to ? (
                          <span className="route-badge">{routeLabel(msg.route_to)}</span>
                        ) : null}
                        <p>{msg.content}</p>
                      </div>
                    ))
                  )}
                </div>
                <div className="chat-actions">
                  <input
                    value={input}
                    onChange={(event) => onInputChange(event.target.value)}
                    placeholder="Ask module_09 to scan files, summarize, or plan."
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        onSendChat();
                      }
                    }}
                  />
                  <button onClick={onSendChat}>Send</button>
                  <button className="ghost" onClick={onOpenScan}>Scan Options</button>
                </div>
                <div className="chat-actions quick-actions">
                  <button className="ghost" onClick={onRunScan}>Run Scan</button>
                  <button className="ghost" onClick={onSyncInbox}>Sync Inbox</button>
                  <button className="ghost" onClick={onRefreshHeadlines}>Refresh Headlines</button>
                </div>
                {isScanning ? (
                  <div className="scan-progress">
                    <div className="scan-progress-bar" />
                    <div className="meta">Scanning in progress... {scanElapsedS}s elapsed</div>
                  </div>
                ) : null}
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
                          <button onClick={() => onApprove(action.id)}>Approve</button>
                          <button onClick={() => onReject(action.id)}>Reject</button>
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
      ) : null}
    </div>
  );
}
