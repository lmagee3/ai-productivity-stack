import { useEffect, useState } from "react";
import { fetchHealth, type HealthStatus } from "./health";
import { fetchOpsSummary, type OpsSummary } from "./ops";

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
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<"dark" | "light" | "crt">("dark");

  useEffect(() => {
    let active = true;
    const check = async () => {
      setLoading(true);
      const result = await fetchHealth();
      const summary = await fetchOpsSummary();
      if (active) {
        setHealth(result);
        setOps(summary);
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
      </section>
    </main>
  );
}
