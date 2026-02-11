import React from 'react';

type BriefTask = {
  id: string;
  title: string;
  meta: string;
  badge: string;
  urgency: 'critical' | 'today' | 'tomorrow' | 'week' | 'later';
};

type BriefGroups = {
  critical: BriefTask[];
  today: BriefTask[];
  tomorrow: BriefTask[];
  week: BriefTask[];
  later: BriefTask[];
};

type BriefPrefs = {
  news: boolean;
  tasks: boolean;
  scan: boolean;
};

type NewsTab = 'markets' | 'geopolitics' | 'tech' | 'science' | 'culture';

type NewsItem = { title: string; body: string; tone?: 'up' | 'down' | 'alert' };

const NEWS: Record<NewsTab, NewsItem[]> = {
  markets: [
    { title: 'Market Pulse', body: 'Broad risk appetite steady. Keep an eye on earnings and macro prints.', tone: 'up' },
    { title: 'Rates Watch', body: 'Treasury curve flat; short-end sensitive to data surprises.' },
  ],
  geopolitics: [
    { title: 'Global Brief', body: 'Maintain awareness of regional flashpoints and supply chain risk.', tone: 'alert' },
  ],
  tech: [
    { title: 'AI Platforms', body: 'Model competition accelerating; focus on local-first reliability.' },
  ],
  science: [
    { title: 'Research Pulse', body: 'Incremental gains in biotech and materials science.' },
  ],
  culture: [
    { title: 'Cultural Radar', body: 'Attention cycles remain short; clarity beats noise.' },
  ],
};

type ScanResult = {
  due: string[];
  tasks: string[];
} | null;

type Props = {
  briefPrefs: BriefPrefs;
  briefGroups: BriefGroups;
  briefChecks: Record<string, boolean>;
  onToggle: (id: string) => void;
  scanResult: ScanResult;
  newsTab: NewsTab;
  setNewsTab: (tab: NewsTab) => void;
  briefDone: number;
  briefTotal: number;
  briefRemaining: number;
  briefPct: number;
};

export function DailyBrief({
  briefPrefs,
  briefGroups,
  briefChecks,
  onToggle,
  scanResult,
  newsTab,
  setNewsTab,
  briefDone,
  briefTotal,
  briefRemaining,
  briefPct,
}: Props) {
  return (
    <div className="daily-brief">
      <div className="brief-header">
        <div>
          <h1>DAILY BRIEF</h1>
          <div className="brief-date">
            {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
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
        {briefPrefs.news ? (
          <div className="brief-col">
            <div className="section">
              <div className="section-title">News Briefing</div>
              <div className="news-cat">
                {(['markets', 'geopolitics', 'tech', 'science', 'culture'] as NewsTab[]).map((tab) => (
                  <button
                    key={tab}
                    className={`news-tab ${newsTab === tab ? 'active' : ''}`}
                    onClick={() => setNewsTab(tab)}
                  >
                    {tab === 'tech' ? 'Tech & AI' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>
              <div className="news-section active">
                {NEWS[newsTab].map((item, idx) => (
                  <div
                    key={idx}
                    className={`news-item ${item.tone === 'up' ? 'tone-up' : item.tone === 'alert' ? 'tone-alert' : item.tone === 'down' ? 'tone-down' : ''}`}
                  >
                    <h3>{item.title}</h3>
                    <p>{item.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {briefPrefs.tasks ? (
          <div className="brief-col">
            <div className="section">
              <div className="section-title">Today's Attack Order</div>
              {(briefGroups.critical.length === 0 && briefGroups.today.length === 0) ? (
                <p className="meta">No critical or today tasks yet.</p>
              ) : (
                <>
                  {briefGroups.critical.map((task) => (
                    <div
                      key={task.id}
                      className={`task priority-critical ${briefChecks[task.id] ? 'checked' : ''}`}
                      onClick={() => onToggle(task.id)}
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
                      className={`task priority-high ${briefChecks[task.id] ? 'checked' : ''}`}
                      onClick={() => onToggle(task.id)}
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
                    className={`task priority-med ${briefChecks[task.id] ? 'checked' : ''}`}
                    onClick={() => onToggle(task.id)}
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
                    className={`task priority-low ${briefChecks[task.id] ? 'checked' : ''}`}
                    onClick={() => onToggle(task.id)}
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
        ) : null}

        {briefPrefs.scan && scanResult ? (
          <div className="section">
            <div className="section-title">Scan Signals</div>
            <div className="news-item"><h3>Due Signals</h3><p>{scanResult.due.slice(0,3).join(' | ') || 'None'}</p></div>
            <div className="news-item"><h3>Proposed Tasks</h3><p>{scanResult.tasks.slice(0,3).join(' | ') || 'None'}</p></div>
          </div>
        ) : null}
      </div>

      <div className="brief-footer">module_09 Daily Brief · Generated {new Date().toLocaleDateString()}</div>
    </div>
  );
}
