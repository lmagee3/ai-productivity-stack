import { useEffect, useMemo, useState } from 'react';
import { fetchHealth, type HealthStatus } from './health';
import { fetchOpsSummary, type OpsSummary } from './ops';
import { fetchOpsNext, type OpsNext } from './ops-next';
import { executeAction, ingestEmail, ingestEmailFetch, ingestWeb, scanFiles, sendChatMessage, type IngestTask, type ProposedAction } from './chat';
import { fetchHeadlines, type Headline } from './news';
import { OverviewPanel } from './features/overview/OverviewPanel';
import { DailyBrief } from './features/brief/DailyBrief';
import { SettingsModal } from './components/SettingsModal';
import { ScanModal } from './components/ScanModal';

const STATUS_LABELS: Record<HealthStatus['status'], string> = {
  ok: 'Online',
  error: 'Unreachable',
  unknown: 'Unknown',
};

type ViewMode = 'mission' | 'brief';

const scanTriggers = /scan|files|file|folder|desktop|check my stuff|check my files|look through/i;

export default function App() {
  type AttackItem = {
    id: string;
    title: string;
    source: string;
    due_at: string | null;
    urgency: 'critical' | 'today' | 'tomorrow' | 'week' | 'later';
    reason: string;
  };
  const [viewMode, setViewMode] = useState<ViewMode>('mission');
  const [missionTab, setMissionTab] = useState<'overview' | 'sprint' | 'timeline' | 'all'>('overview');
  const [health, setHealth] = useState<HealthStatus>({
    status: 'unknown',
    checkedAt: new Date().toISOString(),
  });
  const [ops, setOps] = useState<OpsSummary | null>(null);
  const [opsNext, setOpsNext] = useState<OpsNext | null>(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<'dark' | 'light' | 'crt'>('dark');
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string; route_to?: string }>>([]);
  const [input, setInput] = useState('');
  const [actions, setActions] = useState<ProposedAction[]>([]);
  const [activity, setActivity] = useState<string[]>([]);
  const [scanSummary, setScanSummary] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanElapsedS, setScanElapsedS] = useState(0);
  const [scanPaths, setScanPaths] = useState<string[]>(['~/Desktop']);
  const [headlines, setHeadlines] = useState<Headline[]>([]);
  const [headlinesUpdatedAt, setHeadlinesUpdatedAt] = useState<string | null>(null);
  const [connectorTasks, setConnectorTasks] = useState<IngestTask[]>([]);
  const [scanResult, setScanResult] = useState<{
    due: Array<{ summary: string; priority: 'critical' | 'high' | 'medium' | 'low' }>;
    tasks: Array<{ summary: string; priority: 'critical' | 'high' | 'medium' | 'low' }>;
    hot: string[];
    stale: string[];
    junk: string[];
  } | null>(null);
  const [showScanModal, setShowScanModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [overviewPrefs, setOverviewPrefs] = useState({
    metrics: true,
    charts: true,
    attack: true,
    chat: true,
  });
  const [briefPrefs, setBriefPrefs] = useState({
    news: true,
    tasks: true,
    markets: true,
  });
  const [newsTab, setNewsTab] = useState<'markets' | 'geopolitics' | 'tech' | 'science' | 'culture'>('markets');
  const [briefChecks, setBriefChecks] = useState<Record<string, boolean>>({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [now, setNow] = useState(new Date());
  const [weatherText, setWeatherText] = useState('Weather unavailable');
  const [stocks, setStocks] = useState<Array<{ symbol: string; price: number; changePct: number }>>([]);
  const [stocksUpdatedAt, setStocksUpdatedAt] = useState<string | null>(null);

  const refreshSystemData = async () => {
    setIsRefreshing(true);
    try {
      const result = await fetchHealth();
      const summary = await fetchOpsSummary();
      const next = await fetchOpsNext();
      setHealth(result);
      setOps(summary);
      setOpsNext(next);
      setLoading(false);
      setActivity((prev) => [...prev, "System refresh complete."]);
    } finally {
      setIsRefreshing(false);
    }
  };

  const refreshHeadlines = async () => {
    try {
      const data = await fetchHeadlines();
      setHeadlines(data.headlines);
      setHeadlinesUpdatedAt(data.updated_at);
      setActivity((prev) => [...prev, `Headlines refreshed: ${data.headlines.length}`]);
    } catch {
      setActivity((prev) => [...prev, 'Headlines refresh failed.']);
    }
  };

  useEffect(() => {
    let active = true;
    const check = async () => {
      if (!active) return;
      await refreshSystemData();
    };
    void check();
    const interval = setInterval(check, 10_000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const loadWeather = async () => {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const resp = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m&temperature_unit=fahrenheit`
          );
          const data = await resp.json();
          const temp = data?.current?.temperature_2m;
          if (typeof temp === 'number') setWeatherText(`${Math.round(temp)}°F`);
        } catch {
          // leave fallback text
        }
      });
    };
    void loadWeather();
  }, []);

  useEffect(() => {
    const symbols = ['SPY', 'QQQ', 'NVDA', 'AAPL', 'MSFT'];
    const loadStocks = async () => {
      try {
        const query = symbols.join(',');
        const resp = await fetch(`https://query1.finance.yahoo.com/v7/finance/quote?symbols=${query}`);
        const data = await resp.json();
        const quotes = (data?.quoteResponse?.result ?? []).map((item: any) => ({
          symbol: item.symbol,
          price: Number(item.regularMarketPrice ?? 0),
          changePct: Number(item.regularMarketChangePercent ?? 0),
        })).filter((q: { symbol: string; price: number }) => q.symbol && Number.isFinite(q.price));
        if (quotes.length > 0) {
          setStocks(quotes);
          setStocksUpdatedAt(new Date().toISOString());
        }
      } catch {
        // keep previous quotes
      }
    };
    void loadStocks();
    const interval = setInterval(loadStocks, 30_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let active = true;
    const loadHeadlines = async () => {
      try {
        const data = await fetchHeadlines();
        if (!active) return;
        setHeadlines(data.headlines);
        setHeadlinesUpdatedAt(data.updated_at);
      } catch {
        // keep existing headlines if refresh fails
      }
    };
    void loadHeadlines();
    const interval = setInterval(loadHeadlines, 60 * 60 * 1000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (isScanning) return;
      void handleScan(scanPaths);
    }, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [isScanning, scanPaths]);

  useEffect(() => {
    const stored = localStorage.getItem('module_09_theme');
    if (stored === 'light' || stored === 'dark' || stored === 'crt') {
      setTheme(stored);
    }
  }, []);

  useEffect(() => {
    document.body.dataset.theme = theme;
    localStorage.setItem('module_09_theme', theme);
  }, [theme]);

  useEffect(() => {
    const stored = localStorage.getItem('module_09_prefs');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.overview) setOverviewPrefs(parsed.overview);
        if (parsed.brief) setBriefPrefs(parsed.brief);
      } catch {
        // ignore
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('module_09_prefs', JSON.stringify({ overview: overviewPrefs, brief: briefPrefs }));
  }, [overviewPrefs, briefPrefs]);

  useEffect(() => {
    const stored: Record<string, boolean> = {};
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('brief_task_')) {
        stored[key.replace('brief_task_', '')] = localStorage.getItem(key) === 'done';
      }
    });
    setBriefChecks(stored);
  }, []);

  const attackOrder = useMemo<AttackItem[]>(() => {
    const base: AttackItem[] = [];
    if (opsNext?.next) base.push(opsNext.next as AttackItem);
    if (opsNext?.alternates?.length) base.push(...(opsNext.alternates as AttackItem[]));

    const fromPriority = (p: string): AttackItem['urgency'] => {
      if (p === 'critical') return 'critical';
      if (p === 'high') return 'today';
      if (p === 'medium') return 'week';
      return 'later';
    };

    const scanDerived: AttackItem[] = (scanResult?.tasks ?? []).map((task, idx) => ({
      id: `scan:${idx}:${task.summary}`,
      title: task.summary,
      source: 'files',
      due_at: null,
      urgency: fromPriority(task.priority),
      reason: `Derived from local file scan (${task.priority}).`,
    }));

    const connectorDerived: AttackItem[] = connectorTasks.map((task, idx) => ({
      id: `${task.source}:${idx}:${task.title}`,
      title: task.title,
      source: task.source,
      due_at: task.due_date,
      urgency: fromPriority(task.priority),
      reason: task.summary,
    }));

    const urgencyRank = (u: AttackItem['urgency']) => ({ critical: 0, today: 1, tomorrow: 2, week: 3, later: 4 }[u] ?? 5);
    return [...base, ...connectorDerived, ...scanDerived].sort((a, b) => {
      const ua = urgencyRank(a.urgency);
      const ub = urgencyRank(b.urgency);
      if (ua !== ub) return ua - ub;
      return (a.due_at ?? '9999-12-31').localeCompare(b.due_at ?? '9999-12-31');
    });
  }, [opsNext, scanResult, connectorTasks]);

  const briefTasks = useMemo(() => {
    return attackOrder.map((task) => ({
      id: task.id,
      title: task.title,
      meta: task.reason ?? 'Scheduled',
      urgency: (task.urgency as 'critical' | 'today' | 'tomorrow' | 'week' | 'later') ?? 'later',
      badge: task.source,
    }));
  }, [attackOrder]);

  const briefGroups = useMemo(() => {
    const groups: Record<'critical' | 'today' | 'tomorrow' | 'week' | 'later', typeof briefTasks> = {
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
    localStorage.setItem(`brief_task_${taskId}`, nextValue ? 'done' : '');
  };

  const handleScan = async (paths: string[]) => {
    setScanPaths(paths.length > 0 ? paths : ['~/Desktop']);
    setIsScanning(true);
    setScanElapsedS(0);
    const startedAt = Date.now();
    const ticker = window.setInterval(() => {
      setScanElapsedS(Math.floor((Date.now() - startedAt) / 1000));
    }, 500);
    try {
      const result = await scanFiles(paths);
      setScanSummary(
        `Scanned ${result.scanned} files · ${result.due_signals.length} due signals · ${result.proposed_tasks.length} proposed tasks`
      );
      setScanResult({
        due: (result.due_signals as Array<{ due_date?: string }>).slice(0, 8).map((item) => ({
          summary: item.due_date
            ? `Deliverable identified · due ${item.due_date}`
            : 'Deliverable identified · due date not detected',
          priority: item.due_date ? 'high' : 'medium',
        })),
        tasks: (result.proposed_tasks as Array<{ title?: string; due_date?: string; priority?: 'critical' | 'high' | 'medium' | 'low' }>).slice(0, 8).map((item) => ({
          summary: item.due_date
            ? `${item.title || 'Review deliverable'} · due ${item.due_date}`
            : `${item.title || 'Review deliverable'} · no due date`,
          priority: item.priority || 'medium',
        })),
        hot: [`${result.hot_files.length} recent files identified`],
        stale: [`${result.stale_candidates.length} stale candidates identified`],
        junk: [`${result.junk_candidates.length} junk candidates identified`],
      });
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Scan complete. Results are now visible in Mission Control and Daily Brief.',
          route_to: 'tool',
        },
      ]);
      setActivity((prev) => [...prev, `Scan: ${result.scanned} files`]);
    } catch {
      setActivity((prev) => [...prev, 'Scan failed.']);
    } finally {
      window.clearInterval(ticker);
      setIsScanning(false);
    }
  };

  const openPicker = async () => {
    try {
      setShowScanModal(false);
      const dialog = await import('@tauri-apps/plugin-dialog');
      const selection = await dialog.open({
        multiple: true,
        directory: true,
        title: 'Choose folders to scan',
      });
      if (!selection) {
        setActivity((prev) => [...prev, 'Scan canceled.']);
        return;
      }
      const paths = Array.isArray(selection) ? selection : [selection];
      await handleScan(paths.filter((p): p is string => typeof p === 'string'));
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'unknown error';
      setActivity((prev) => [...prev, `File picker failed: ${detail}`]);
    }
  };

  const syncInbox = async () => {
    try {
      const result = await ingestEmailFetch(10, 'INBOX');
      const newTasks = result.items.flatMap((item) => item.proposed_tasks);
      setConnectorTasks((prev) => [...prev, ...newTasks]);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Inbox sync complete: ${result.count} emails analyzed, ${newTasks.length} proposed tasks.`,
          route_to: 'tool',
        },
      ]);
      setActivity((prev) => [...prev, `Inbox sync: ${result.count} emails`]);
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'unknown error';
      setMessages((prev) => [...prev, { role: 'assistant', content: `Inbox sync failed: ${detail}`, route_to: 'tool' }]);
      setActivity((prev) => [...prev, 'Inbox sync failed.']);
    }
  };

  const handleChatSubmit = async () => {
    if (!input.trim()) return;
    const nextMessage = input.trim();
    const wantsScan = scanTriggers.test(nextMessage);
    setMessages((prev) => [...prev, { role: 'user', content: nextMessage }]);
    setInput('');
    const normalized = nextMessage.trim().toLowerCase();
    if (
      normalized === '/ingest/email/fetch' ||
      normalized.includes('sync inbox') ||
      normalized.includes('fetch latest emails') ||
      normalized.includes('sync gmail')
    ) {
      await syncInbox();
      return;
    }
    const urlMatch = nextMessage.match(/https?:\/\/\S+/i);
    if (urlMatch) {
      try {
        const ingest = await ingestWeb(urlMatch[0]);
        setConnectorTasks((prev) => [...prev, ...ingest.proposed_tasks]);
        setMessages((prev) => [...prev, { role: 'assistant', content: `Web ingest complete: ${ingest.summary}`, route_to: 'tool' }]);
        setActivity((prev) => [...prev, `Web ingest: ${ingest.proposed_tasks.length} proposed tasks`]);
      } catch {
        setActivity((prev) => [...prev, 'Web ingest failed.']);
      }
      return;
    }
    if (nextMessage.toLowerCase().startsWith('email:')) {
      const body = nextMessage.slice(6).trim();
      if (body) {
        try {
          const ingest = await ingestEmail('Email from chat', body);
          setConnectorTasks((prev) => [...prev, ...ingest.proposed_tasks]);
          setMessages((prev) => [...prev, { role: 'assistant', content: `Email ingest complete: ${ingest.summary}`, route_to: 'tool' }]);
          setActivity((prev) => [...prev, `Email ingest: ${ingest.proposed_tasks.length} proposed tasks`]);
        } catch {
          setActivity((prev) => [...prev, 'Email ingest failed.']);
        }
      }
      return;
    }
    if (wantsScan) {
      setShowScanModal(true);
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Opening scan options. Choose Desktop or a folder.', route_to: 'tool' }]);
      return;
    }
    try {
      const response = await sendChatMessage(nextMessage, sessionId ?? undefined);
      setSessionId(response.session_id);
      setMessages((prev) => [...prev, { role: 'assistant', content: response.assistant_message, route_to: response.route_to }]);
      setActions((prev) => [...prev, ...response.proposed_actions]);
    } catch {
      setActivity((prev) => [...prev, 'Chat error: failed to reach backend.']);
    }
  };

  const totalTasks = ops?.tasks.total ?? 0;
  const overdueTasks = ops?.tasks.overdue ?? 0;
  const dueSoonTasks = ops?.tasks.due_24h ?? 0;
  const blackboardTotal = ops?.blackboard.total ?? 0;

  const briefDone = briefTasks.filter((task) => briefChecks[task.id]).length;
  const briefTotal = briefTasks.length;
  const briefRemaining = briefTotal - briefDone;
  const briefPct = briefTotal === 0 ? 0 : Math.round((briefDone / briefTotal) * 100);
  const burndown = useMemo(() => {
    const points = 8;
    const ideal = Array.from({ length: points }, (_, i) => Math.max(0, briefTotal - (briefTotal * i) / (points - 1)));
    const doneNow = briefDone;
    const progressSlope = points > 1 ? doneNow / (points - 1) : doneNow;
    const actual = Array.from({ length: points }, (_, i) => Math.max(0, briefTotal - progressSlope * i));
    return { ideal, actual };
  }, [briefDone, briefTotal]);
  const linePath = (values: number[]) => {
    if (values.length === 0) return '';
    const max = Math.max(1, briefTotal);
    return values
      .map((value, idx) => {
        const x = (idx / (values.length - 1)) * 100;
        const y = 100 - (value / max) * 100;
        return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
      })
      .join(' ');
  };

  return (
    <main className="module-shell">
      <div className="app">
        <div className="header">
          <div>
            <h1>module_09</h1>
            <div className="header-sub">
              Local time {now.toLocaleString()} · Weather {weatherText}
            </div>
          </div>
          <div className="header-actions">
            <button className="sync-btn" onClick={() => void refreshSystemData()}>
              ↻ {isRefreshing ? 'Syncing...' : 'Refresh'}
            </button>
            <button className="settings-btn" onClick={() => setShowSettings(true)}>Settings</button>
            <div className="view-toggle" role="group" aria-label="View toggle">
              <button className={viewMode === 'mission' ? 'active' : ''} onClick={() => setViewMode('mission')}>
                Mission Control
              </button>
              <button className={viewMode === 'brief' ? 'active' : ''} onClick={() => setViewMode('brief')}>
                Daily Brief
              </button>
            </div>
            <div className="theme-toggle" role="group" aria-label="Theme toggle">
              <button className={theme === 'light' ? 'active' : ''} onClick={() => setTheme('light')}>Light</button>
              <button className={theme === 'dark' ? 'active' : ''} onClick={() => setTheme('dark')}>Dark</button>
              <button className={theme === 'crt' ? 'active' : ''} onClick={() => setTheme('crt')}>CRT</button>
            </div>
          </div>
        </div>

        {viewMode === 'mission' ? (
          <div className="mission-layout">
            <section className="mission-main">
            <div className="status">
              <span className={`status-dot status-${health.status}`} />
              <div>
                <div className="label">API Status</div>
                <div className="value">{loading ? 'Checking...' : STATUS_LABELS[health.status]}</div>
                <div className="meta">Last checked: {new Date(health.checkedAt).toLocaleTimeString()}</div>
              </div>
            </div>

            {(overdueTasks > 0 || dueSoonTasks > 0) && (
              <div className={`alert ${overdueTasks > 0 ? 'alert-red' : 'alert-yellow'}`}>
                <span className="alert-icon">⚠</span>
                <div>
                  {overdueTasks > 0 && (
                    <strong>{overdueTasks} overdue task{overdueTasks === 1 ? '' : 's'}.</strong>
                  )}{' '}
                  {dueSoonTasks > 0 && (
                    <strong>{dueSoonTasks} due within 24h.</strong>
                  )}
                  <span className="alert-note"> Focus on these first.</span>
                </div>
              </div>
            )}

            <div className="nav">
              {(['overview', 'sprint', 'timeline', 'all'] as const).map((tab) => (
                <button
                  key={tab}
                  className={`nav-btn ${missionTab === tab ? 'active' : ''}`}
                  onClick={() => setMissionTab(tab)}
                >
                  {tab === 'overview' ? 'Overview' : tab === 'sprint' ? 'Sprint' : tab === 'timeline' ? 'Timeline' : 'All Tasks'}
                </button>
              ))}
            </div>

            {missionTab === 'overview' && (
              <OverviewPanel
                prefs={overviewPrefs}
                totalTasks={totalTasks}
                overdueTasks={overdueTasks}
                dueSoonTasks={dueSoonTasks}
                blackboardTotal={blackboardTotal}
                attackOrder={attackOrder}
                scanResult={scanResult}
              />
            )}

            {missionTab === 'sprint' && (
              <div className="section-card">
                <div className="section-header">
                  <span className="sh-icon">⚑</span>
                  <h3>Sprint Burndown</h3>
                </div>
                <div className="meta">Ideal vs actual remaining work for current sprint.</div>
                <div className="sp-labels" style={{ marginTop: 10 }}>
                  <span>{briefDone}/{briefTotal} tasks complete</span>
                  <span>{briefPct}%</span>
                </div>
                <div className="sp-bar-wrap">
                  <div className="sp-bar-fill" style={{ width: `${briefPct}%` }} />
                </div>
                <div className="burndown-graph" style={{ marginTop: 14 }}>
                  <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="burndown-svg">
                    <path d={linePath(burndown.ideal)} className="burndown-ideal" />
                    <path d={linePath(burndown.actual)} className="burndown-actual" />
                  </svg>
                  <div className="burndown-legend">
                    <span><i className="dot ideal" /> Ideal</span>
                    <span><i className="dot actual" /> Actual</span>
                  </div>
                </div>
              </div>
            )}

            {missionTab === 'timeline' && (
              <div className="section-card">
                <div className="section-header">
                  <span className="sh-icon">📅</span>
                  <h3>Timeline View</h3>
                </div>
                <div className="meta">Near-term due timeline from current Attack Order.</div>
                <div className="sug-list" style={{ marginTop: 12 }}>
                  {attackOrder.slice(0, 10).map((task) => (
                    <div key={`tl-${task.id}`} className="task-row">
                      <span className="task-name">{task.title}</span>
                      <span className="domain-tag">{task.source}</span>
                      <span className={`badge badge-${task.urgency}`}>{task.urgency}</span>
                      <span className="days-label">{task.due_at ?? 'No date'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {missionTab === 'all' && (
              <div className="section-card">
                <div className="section-header">
                  <span className="sh-icon">💡</span>
                  <h3>All Tasks</h3>
                </div>
                <div className="meta">Combined task feed across ops, files, email, and web.</div>
                <div className="sug-list" style={{ marginTop: 12 }}>
                  {attackOrder.map((task) => (
                    <div key={`all-${task.id}`} className="task-row">
                      <span className="task-name">{task.title}</span>
                      <span className="domain-tag">{task.source}</span>
                      <span className={`badge badge-${task.urgency}`}>{task.urgency}</span>
                      <span className="days-label">{task.due_at ?? 'No date'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            </section>
            <aside className="mission-chat-rail">
              <div className="chat-panel chat-panel-stretch">
                <div className="chat-panel-header">Local Brain Chat</div>
                <div className="chat-window chat-window-tall">
                  {messages.length === 0 ? (
                    <p className="meta">Ask module_09 to scan your desktop or plan your next move.</p>
                  ) : (
                    messages.map((msg, idx) => (
                      <div key={idx} className={`chat-bubble ${msg.role}`}>
                        <span className="chat-role">{msg.role}</span>
                        {msg.role === 'assistant' && msg.route_to ? (
                          <span className="route-badge">{msg.route_to === 'local_fast' ? 'FAST' : msg.route_to === 'local_deep' ? 'DEEP' : msg.route_to === 'cloud_pending_approval' ? 'CLOUD PENDING APPROVAL' : msg.route_to.toUpperCase()}</span>
                        ) : null}
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
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        void handleChatSubmit();
                      }
                    }}
                  />
                  <button onClick={() => void handleChatSubmit()}>Send</button>
                </div>
                {isScanning ? (
                  <div className="scan-progress">
                    <div className="scan-progress-bar" />
                    <div className="meta">Scanning in progress... {scanElapsedS}s elapsed</div>
                  </div>
                ) : null}
                {scanSummary ? <div className="chat-meta">{scanSummary}</div> : null}
              </div>

              <div className="chat-panel">
                <div className="chat-panel-header">Proposed Actions</div>
                <div className="chat-actions quick-actions">
                  <button className="ghost" onClick={() => setShowScanModal(true)}>Run Scan</button>
                  <button className="ghost" onClick={() => void syncInbox()}>Sync Inbox</button>
                </div>
                {actions.length === 0 ? (
                  <p className="meta">No proposed actions yet.</p>
                ) : (
                  <ul className="list">
                    {actions.map((action) => (
                      <li key={action.id}>
                        <strong>{action.tool_name}</strong>
                        <div className="meta">Status: {action.status}</div>
                        <div className="action-buttons">
                          <button onClick={async () => {
                            const result = await executeAction(action.id, true);
                            setActivity((prev) => [...prev, `Executed action: ${result.status}`]);
                          }}>Approve</button>
                          <button onClick={async () => {
                            const result = await executeAction(action.id, false);
                            setActivity((prev) => [...prev, `Rejected action: ${result.status}`]);
                          }}>Reject</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </aside>
          </div>
        ) : (
          <DailyBrief
            briefPrefs={briefPrefs}
            briefGroups={briefGroups}
            briefChecks={briefChecks}
            onToggle={toggleBriefTask}
            newsTab={newsTab}
            setNewsTab={setNewsTab}
            briefDone={briefDone}
            briefTotal={briefTotal}
            briefRemaining={briefRemaining}
            briefPct={briefPct}
            headlines={headlines}
            headlinesUpdatedAt={headlinesUpdatedAt}
            stocks={stocks}
            stocksUpdatedAt={stocksUpdatedAt}
          />
        )}
      </div>

      <SettingsModal
        open={showSettings}
        overviewPrefs={overviewPrefs}
        briefPrefs={briefPrefs}
        onClose={() => setShowSettings(false)}
        onOverviewChange={setOverviewPrefs}
        onBriefChange={setBriefPrefs}
      />

      <ScanModal
        open={showScanModal}
        onClose={() => setShowScanModal(false)}
        onScanDesktop={() => {
          setShowScanModal(false);
          void handleScan(['~/Desktop']);
        }}
        onPickFolders={() => openPicker()}
        
      />
    </main>
  );
}
