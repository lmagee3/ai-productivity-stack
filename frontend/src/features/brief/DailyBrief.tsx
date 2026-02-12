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
  markets: boolean;
};

type NewsTab = 'markets' | 'geopolitics' | 'tech' | 'science' | 'culture';

type NewsItem = { title: string; body: string; tone?: 'up' | 'down' | 'alert' };

const MAX_TASK_TITLE = 96;
const MAX_TASK_META = 120;

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

function cleanTaskText(text: string): string {
  return text
    .replace(/\/[\w.\-/]+/g, '[path]')
    .replace(/([A-Za-z0-9_-]+)\.(pdf|docx|txt|xml|md|csv|xlsx|pptx|js|ts|tsx|py)\b/gi, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function classifyHeadline(title: string): NewsTab {
  const t = title.toLowerCase();
  if (/(market|stock|fed|rate|economy|earnings|crypto|bond|nasdaq|dow|s&p)/.test(t)) return 'markets';
  if (/(war|election|policy|government|sanction|china|russia|nato|middle east|ukraine)/.test(t)) return 'geopolitics';
  if (/(ai|openai|xai|model|chip|software|startup|tech|robot|apple|google|microsoft)/.test(t)) return 'tech';
  if (/(science|nasa|space|research|study|climate|physics|biology|medicine)/.test(t)) return 'science';
  return 'culture';
}

type Props = {
  briefPrefs: BriefPrefs;
  briefGroups: BriefGroups;
  briefChecks: Record<string, boolean>;
  onToggle: (id: string) => void;
  newsTab: NewsTab;
  setNewsTab: (tab: NewsTab) => void;
  briefDone: number;
  briefTotal: number;
  briefRemaining: number;
  briefPct: number;
  headlines: Array<{ title: string; source: string; url: string; published_at: string | null }>;
  headlinesUpdatedAt: string | null;
  stocks: Array<{ symbol: string; price: number; changePct: number }>;
  stocksUpdatedAt: string | null;
};

export function DailyBrief({
  briefPrefs,
  briefGroups,
  briefChecks,
  onToggle,
  newsTab,
  setNewsTab,
  briefDone,
  briefTotal,
  briefRemaining,
  briefPct,
  headlines,
  headlinesUpdatedAt,
  stocks,
  stocksUpdatedAt,
}: Props) {
  const badgeClass = (badge: string) => {
    const value = badge.toLowerCase();
    if (value.includes("kairos")) return "badge-source badge-domain-kairos";
    if (value.includes("school")) return "badge-source badge-domain-school";
    if (value.includes("job")) return "badge-source badge-domain-job";
    if (value.includes("personal")) return "badge-source badge-domain-personal";
    if (value.includes("email")) return "badge-source badge-domain-email";
    if (value.includes("web")) return "badge-source badge-domain-web";
    if (value.includes("files")) return "badge-source badge-domain-files";
    return "badge-source";
  };

  const newsByTab = React.useMemo(() => {
    const grouped: Record<NewsTab, NewsItem[]> = {
      markets: [],
      geopolitics: [],
      tech: [],
      science: [],
      culture: [],
    };
    headlines.forEach((item) => {
      const tab = classifyHeadline(item.title);
      const when = item.published_at ? new Date(item.published_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'recent';
      grouped[tab].push({
        title: truncate(item.title, 110),
        body: `${item.source} · ${when}`,
      });
    });
    return grouped;
  }, [headlines]);

  const activeNews: NewsItem[] = (newsByTab[newsTab].length > 0 ? newsByTab[newsTab] : headlines.map((h) => ({
    title: truncate(h.title, 110),
    body: `${h.source} · ${h.published_at ? new Date(h.published_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'recent'}`,
  }))).slice(0, 4);

  const renderTask = (task: BriefTask, className: string) => {
    const priorityTag = task.urgency === 'critical' ? 'CRITICAL' : task.urgency === 'today' ? 'TODAY' : task.urgency.toUpperCase();
    const cleanTitle = truncate(cleanTaskText(task.title), MAX_TASK_TITLE);
    const cleanMeta = truncate(cleanTaskText(task.meta), MAX_TASK_META);
    return (
      <div
        key={task.id}
        className={`task ${className} ${briefChecks[task.id] ? 'checked' : ''}`}
        onClick={() => onToggle(task.id)}
      >
        <input type="checkbox" checked={briefChecks[task.id] ?? false} readOnly />
        <div className="task-body">
          <div className="task-name">
            <span className="task-title">{cleanTitle}</span>
            <span className={badgeClass(task.badge)}>{task.badge}</span>
          </div>
          <div className="task-meta">{priorityTag} · {cleanMeta}</div>
        </div>
      </div>
    );
  };

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
                {activeNews.map((item, idx) => (
                  <div
                    key={idx}
                    className={`news-item ${item.tone === 'up' ? 'tone-up' : item.tone === 'alert' ? 'tone-alert' : item.tone === 'down' ? 'tone-down' : ''}`}
                  >
                    <h3>{item.title}</h3>
                    <p>{item.body}</p>
                  </div>
                ))}
                {activeNews.length === 0 && headlines.length === 0 ? (
                  <p className="meta">Loading headlines...</p>
                ) : null}
                <div className="meta">
                  Updated {headlinesUpdatedAt ? new Date(headlinesUpdatedAt).toLocaleTimeString() : 'recently'}
                </div>
              </div>
            </div>
            {briefPrefs.markets ? (
              <div className="section">
                <div className="section-title">Market Ticker</div>
                {stocks.length === 0 ? (
                  <p className="meta">Waiting for market feed...</p>
                ) : (
                  <div className="stock-grid">
                    {stocks.map((quote) => (
                      <div key={quote.symbol} className="stock-item">
                        <div className="stock-symbol">{quote.symbol}</div>
                        <div className="stock-price">${quote.price.toFixed(2)}</div>
                        <div className={`stock-change ${quote.changePct >= 0 ? 'up' : 'down'}`}>
                          {quote.changePct >= 0 ? '+' : ''}{quote.changePct.toFixed(2)}%
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="meta">Updated {stocksUpdatedAt ? new Date(stocksUpdatedAt).toLocaleTimeString() : 'recently'}</div>
              </div>
            ) : null}
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
                  {briefGroups.critical.map((task) => renderTask(task, 'priority-critical'))}
                  {briefGroups.today.map((task) => renderTask(task, 'priority-high'))}
                </>
              )}
            </div>

            <div className="section">
              <div className="section-title">Tomorrow</div>
              {briefGroups.tomorrow.length === 0 ? (
                <p className="meta">No tasks due tomorrow.</p>
              ) : (
                briefGroups.tomorrow.map((task) => renderTask(task, 'priority-med'))
              )}
            </div>

            <div className="section">
              <div className="section-title">This Week</div>
              {briefGroups.week.length === 0 ? (
                <p className="meta">No tasks due this week.</p>
              ) : (
                briefGroups.week.map((task) => renderTask(task, 'priority-low'))
              )}
            </div>

            <button className="report-btn">Generate End-of-Day Report</button>
          </div>
        ) : null}
      </div>

      <div className="brief-footer">module_09 Daily Brief · Generated {new Date().toLocaleDateString()}</div>
    </div>
  );
}
