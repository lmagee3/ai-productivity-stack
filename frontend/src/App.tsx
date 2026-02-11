import { useEffect, useMemo, useState } from 'react';
import { fetchHealth, type HealthStatus } from './health';
import { fetchOpsSummary, type OpsSummary } from './ops';
import { fetchOpsNext, type OpsNext } from './ops-next';
import { executeAction, scanFiles, sendChatMessage, type ProposedAction } from './chat';
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

const isTauri = () => typeof (window as any).__TAURI__ !== 'undefined';

export default function App() {
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
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [input, setInput] = useState('');
  const [actions, setActions] = useState<ProposedAction[]>([]);
  const [activity, setActivity] = useState<string[]>([]);
  const [scanSummary, setScanSummary] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<{
    due: string[];
    tasks: string[];
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
    scan: true,
  });
  const [newsTab, setNewsTab] = useState<'markets' | 'geopolitics' | 'tech' | 'science' | 'culture'>('markets');
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

  const attackOrder = useMemo(() => {
    if (!opsNext?.next) return [];
    return [opsNext.next, ...opsNext.alternates];
  }, [opsNext]);

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
    try {
      const result = await scanFiles(paths);
      setScanSummary(
        `Scanned ${result.scanned} files · ${result.due_signals.length} due signals · ${result.proposed_tasks.length} proposed tasks`
      );
      setScanResult({
        due: (result.due_signals as Array<{ path?: string; title?: string }>).map((item) => item.path || item.title || '').filter(Boolean),
        tasks: (result.proposed_tasks as Array<{ title?: string; path?: string }>).map((item) => item.title || item.path || '').filter(Boolean),
        hot: (result.hot_files as Array<{ path?: string; title?: string }>).map((item) => item.path || item.title || '').filter(Boolean),
        stale: (result.stale_candidates as Array<{ path?: string; title?: string }>).map((item) => item.path || item.title || '').filter(Boolean),
        junk: (result.junk_candidates as Array<{ path?: string; title?: string }>).map((item) => item.path || item.title || '').filter(Boolean),
      });
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Scan complete. Results are now visible in Mission Control and Daily Brief.',
        },
      ]);
      setActivity((prev) => [...prev, `Scan: ${result.scanned} files`]);
    } catch {
      setActivity((prev) => [...prev, 'Scan failed.']);
    }
  };

  const openPicker = async () => {
    if (!isTauri()) {
      setActivity((prev) => [...prev, 'File picker is available in the desktop app only.']);
      return;
    }
    try {
      setShowScanModal(false);
      const dialog = await import('@tauri-apps/plugin-dialog');
      const selection = await dialog.open({
        multiple: true,
        directory: true,
        title: 'Choose folders to scan',
      });
      if (!selection) return;
      const paths = Array.isArray(selection) ? selection : [selection];
      await handleScan(paths);
    } catch {
      setActivity((prev) => [...prev, 'File picker failed.']);
    }
  };

  const handleChatSubmit = async () => {
    if (!input.trim()) return;
    const nextMessage = input.trim();
    const wantsScan = scanTriggers.test(nextMessage);
    setMessages((prev) => [...prev, { role: 'user', content: nextMessage }]);
    setInput('');
    if (wantsScan) {
      setShowScanModal(true);
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Opening scan options. Choose Desktop or a folder.' }]);
      return;
    }
    try {
      const response = await sendChatMessage(nextMessage, sessionId ?? undefined);
      setSessionId(response.session_id);
      setMessages((prev) => [...prev, { role: 'assistant', content: response.assistant_message }]);
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

  return (
    <main className="module-shell">
      <div className="app">
        <div className="header">
          <div>
            <h1>◔ Mission Control</h1>
            <div className="header-sub">
              Local-first command center · {new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
          </div>
          <div className="header-actions">
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
          <>
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
                messages={messages}
                actions={actions}
                activity={activity}
                scanSummary={scanSummary}
                onSendChat={handleChatSubmit}
                onOpenScan={() => setShowScanModal(true)}
                onApprove={async (id) => {
                  const result = await executeAction(id, true);
                  setActivity((prev) => [...prev, `Executed action: ${result.status}`]);
                }}
                onReject={async (id) => {
                  const result = await executeAction(id, false);
                  setActivity((prev) => [...prev, `Rejected action: ${result.status}`]);
                }}
                input={input}
                onInputChange={setInput}
              />
            )}

            {missionTab !== 'overview' && (
              <div className="section-card">
                <div className="section-header">
                  <span className="sh-icon">💡</span>
                  <h3>{missionTab === 'sprint' ? 'Sprint' : missionTab === 'timeline' ? 'Timeline' : 'All Tasks'}</h3>
                </div>
                <p className="meta">This view will populate as more task data is synced.</p>
              </div>
            )}
          </>
        ) : (
          <DailyBrief
            briefPrefs={briefPrefs}
            briefGroups={briefGroups}
            briefChecks={briefChecks}
            onToggle={toggleBriefTask}
            scanResult={scanResult ? { due: scanResult.due, tasks: scanResult.tasks } : null}
            newsTab={newsTab}
            setNewsTab={setNewsTab}
            briefDone={briefDone}
            briefTotal={briefTotal}
            briefRemaining={briefRemaining}
            briefPct={briefPct}
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
