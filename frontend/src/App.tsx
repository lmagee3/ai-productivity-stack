import { useEffect, useState } from "react";
import { fetchHealth, type HealthStatus } from "./health";

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const check = async () => {
      setLoading(true);
      const result = await fetchHealth();
      if (active) {
        setHealth(result);
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

  return (
    <main className="shell">
      <section className="card">
        <header>
          <p className="eyebrow">MAGE</p>
          <h1>Local-first AI Productivity</h1>
          <p className="subtitle">
            Backend health is checked every 10 seconds from the desktop shell.
          </p>
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
      </section>
    </main>
  );
}
