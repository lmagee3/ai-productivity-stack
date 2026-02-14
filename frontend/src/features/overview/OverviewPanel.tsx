import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Chart, DoughnutController, BarController, ArcElement, BarElement, CategoryScale, LinearScale, Legend, Tooltip } from 'chart.js';

Chart.register(DoughnutController, BarController, ArcElement, BarElement, CategoryScale, LinearScale, Legend, Tooltip);

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
  url?: string | null;
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
};

export function OverviewPanel({
  prefs,
  totalTasks,
  overdueTasks,
  dueSoonTasks,
  blackboardTotal,
  attackOrder,
  scanResult,
}: Props) {
  const [showAllAttack, setShowAllAttack] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<string>("all");

  // Get current theme for chart colors (reactive to theme changes)
  const [theme, setTheme] = useState(() => document.body.dataset.theme || 'dark');
  const isCRT = theme === 'crt';

  // Listen for theme changes
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setTheme(document.body.dataset.theme || 'dark');
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  // Chart refs
  const statusChartRef = useRef<HTMLCanvasElement>(null);
  const sourceChartRef = useRef<HTMLCanvasElement>(null);
  const focusChartRef = useRef<HTMLCanvasElement>(null);
  const statusChartInstance = useRef<Chart | null>(null);
  const sourceChartInstance = useRef<Chart | null>(null);
  const focusChartInstance = useRef<Chart | null>(null);

  // Compute chart data from attack order
  const chartData = useMemo(() => {
    const statusCounts = { done: 0, progress: 0, todo: 0, blocked: 0 };
    const sourceCounts: Record<string, number> = {};
    const focusCounts: Record<string, { high: number; medium: number }> = {};

    attackOrder.forEach((task) => {
      const urg = task.urgency?.toLowerCase() ?? '';
      if (urg === 'critical' || urg === 'today') statusCounts.progress++;
      else if (urg === 'tomorrow' || urg === 'week') statusCounts.todo++;
      else if (urg === 'later') statusCounts.todo++;
      else statusCounts.todo++;

      const src = task.source || 'Unknown';
      sourceCounts[src] = (sourceCounts[src] || 0) + 1;

      if (!focusCounts[src]) focusCounts[src] = { high: 0, medium: 0 };
      if (urg === 'critical' || urg === 'today') focusCounts[src].high++;
      else focusCounts[src].medium++;
    });

    return { statusCounts, sourceCounts, focusCounts };
  }, [attackOrder]);

  // Status doughnut chart
  useEffect(() => {
    if (!statusChartRef.current || !prefs.charts) return;
    if (statusChartInstance.current) statusChartInstance.current.destroy();

    const { statusCounts } = chartData;
    const statusColors = isCRT
      ? ['#00ff7b', '#60ffa6', '#7edc8f', '#0b3b1c'] // CRT: all green shades
      : ['#22c55e', '#3b82f6', '#6b7280', '#ef4444']; // Dark/Light: green, blue, grey, red
    const labelColor = isCRT ? '#7edc8f' : '#6b7280';

    statusChartInstance.current = new Chart(statusChartRef.current, {
      type: 'doughnut',
      data: {
        labels: ['Done', 'In Progress', 'To Do', 'Blocked'],
        datasets: [{
          data: [statusCounts.done, statusCounts.progress, statusCounts.todo, statusCounts.blocked],
          backgroundColor: statusColors,
          borderWidth: 0,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '60%',
        plugins: {
          legend: { position: 'bottom', labels: { color: labelColor, font: { size: 11 }, boxWidth: 10, padding: 8 } },
        },
      },
    });

    return () => { statusChartInstance.current?.destroy(); };
  }, [chartData, prefs.charts, isCRT]);

  // Source doughnut chart
  useEffect(() => {
    if (!sourceChartRef.current || !prefs.charts) return;
    if (sourceChartInstance.current) sourceChartInstance.current.destroy();

    const { sourceCounts } = chartData;
    const labels = Object.keys(sourceCounts);
    const data = Object.values(sourceCounts);
    const DOMAIN_COLORS = isCRT
      ? ['#00ff7b', '#60ffa6', '#7edc8f', '#00f09d', '#0b3b1c', '#0f4a22'] // CRT: green spectrum only
      : ['#a78bfa', '#60a5fa', '#fbbf24', '#22d3ee', '#34d399', '#fb923c', '#f472b6']; // Dark/Light: varied colors
    const labelColor = isCRT ? '#7edc8f' : '#6b7280';

    sourceChartInstance.current = new Chart(sourceChartRef.current, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: labels.map((_, i) => DOMAIN_COLORS[i % DOMAIN_COLORS.length]),
          borderWidth: 0,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '60%',
        plugins: {
          legend: { position: 'bottom', labels: { color: labelColor, font: { size: 11 }, boxWidth: 10, padding: 8 } },
        },
      },
    });

    return () => { sourceChartInstance.current?.destroy(); };
  }, [chartData, prefs.charts, isCRT]);

  // Focus load horizontal bar chart
  useEffect(() => {
    if (!focusChartRef.current || !prefs.charts) return;
    if (focusChartInstance.current) focusChartInstance.current.destroy();

    const { focusCounts } = chartData;
    const labels = Object.keys(focusCounts);
    const highData = labels.map((l) => focusCounts[l].high);
    const medData = labels.map((l) => focusCounts[l].medium);

    const highColor = isCRT ? '#00ff7b' : '#ef4444'; // CRT: bright green, else red
    const medColor = isCRT ? '#60ffa6' : '#f59e0b'; // CRT: medium green, else amber
    const gridColor = isCRT ? '#0b3b1c' : '#1e1e2e';
    const tickColor = isCRT ? '#7edc8f' : '#6b7280';
    const tickColorAlt = isCRT ? '#7edc8f' : '#9ca3af';

    focusChartInstance.current = new Chart(focusChartRef.current, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'High', data: highData, backgroundColor: highColor },
          { label: 'Medium', data: medData, backgroundColor: medColor },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        scales: {
          x: { stacked: true, grid: { color: gridColor }, ticks: { color: tickColor } },
          y: { stacked: true, grid: { display: false }, ticks: { color: tickColorAlt } },
        },
        plugins: {
          legend: { position: 'bottom', labels: { color: tickColor, font: { size: 11 }, boxWidth: 10, padding: 8 } },
        },
      },
    });

    return () => { focusChartInstance.current?.destroy(); };
  }, [chartData, prefs.charts, isCRT]);

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
              {attackOrder.length > 0 ? (
                <canvas ref={statusChartRef} />
              ) : (
                <div className="chart-placeholder">No chart data yet</div>
              )}
            </div>
          </div>
          <div className="chart-card">
            <h3>By Source</h3>
            <div className="chart-wrap">
              {attackOrder.length > 0 ? (
                <canvas ref={sourceChartRef} />
              ) : (
                <div className="chart-placeholder">Awaiting more data</div>
              )}
            </div>
          </div>
          <div className="chart-card">
            <h3>Focus Load</h3>
            <div className="chart-wrap">
              {attackOrder.length > 0 ? (
                <canvas ref={focusChartRef} />
              ) : (
                <div className="chart-placeholder">Sync more tasks to unlock</div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {prefs.attack ? (
        <div className="section-card attack-order">
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
                    {task.url ? (
                      <a href={task.url} target="_blank" rel="noopener noreferrer" className="sug-name sug-link">
                        {task.title}
                      </a>
                    ) : (
                      <div className="sug-name">{task.title}</div>
                    )}
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
        <div className="section-card scan-signals">
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

    </div>
  );
}
