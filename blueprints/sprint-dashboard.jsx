import { useState, useMemo } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { AlertTriangle, CheckCircle, Clock, Target, Zap, ChevronDown, ChevronUp, TrendingUp, Calendar, Flag } from "lucide-react";

const TASKS = [
  { id: 1, name: "Fix mic crash/freeze (VoiceManager teardown + audio session)", due: "2026-02-13", priority: "High", domain: "Kairos", status: "In Progress", sprint: true },
  { id: 2, name: "Demo to Amico / Konnectryx", due: "2026-03-06", priority: "High", domain: "Kairos", status: "In Progress", sprint: true },
  { id: 3, name: "Fix LinkedIn headline, email, and Open to Work settings", due: "2026-02-07", priority: "High", domain: "Job Search", status: "To Do" },
  { id: 4, name: "Submit MBA assignment by Friday", due: "2026-02-07", priority: "High", domain: "School", status: "To Do" },
  { id: 5, name: "Apply for Bellevue University Scholarships", due: "2026-02-07", priority: "High", domain: "School", status: "To Do" },
  { id: 6, name: "Review + finalize new resume", due: "2026-02-08", priority: "High", domain: "Job Search", status: "To Do" },
  { id: 7, name: "Rewrite LinkedIn About section + update experience", due: "2026-02-09", priority: "High", domain: "Job Search", status: "To Do" },
  { id: 8, name: "GitHub cleanup — make Kairos + Deep private, delete tutorial repos", due: "2026-02-09", priority: "High", domain: "Job Search", status: "To Do" },
  { id: 9, name: "Create AI Productivity Stack showcase repo", due: "2026-02-09", priority: "High", domain: "Job Search", status: "To Do" },
  { id: 10, name: "Update GitHub bio + profile, pin showcase repo", due: "2026-02-09", priority: "Medium", domain: "Job Search", status: "To Do" },
  { id: 11, name: "Review Spring Registration & Degree Audit", due: "2026-02-08", priority: "High", domain: "School", status: "To Do" },
  { id: 12, name: "Review Week 7 Course Announcements", due: "2026-02-08", priority: "Medium", domain: "School", status: "To Do" },
  { id: 13, name: "Start remote contract job search", due: "2026-02-10", priority: "High", domain: "Personal", status: "To Do" },
  { id: 14, name: "Write READMEs for Kairos + Deep repos", due: "2026-02-12", priority: "Medium", domain: "Job Search", status: "To Do" },
  { id: 15, name: "LinkedIn connection blitz — target 500", due: "2026-02-14", priority: "Medium", domain: "Job Search", status: "To Do" },
  { id: 16, name: "Pay Mom's storage fee", due: "2026-02-15", priority: "Medium", domain: "Personal", status: "To Do" },
  { id: 17, name: "Record Kairos MVP demo", due: "2026-02-28", priority: "High", domain: "Kairos", status: "To Do", sprint: true },
  { id: 18, name: "Build ElevenLabsTTSProvider.swift", due: "2026-02-20", priority: "High", domain: "Kairos", status: "Blocked", sprint: true },
  { id: 19, name: "Wire ElevenLabs into ChatViewModel + test E2E", due: "2026-02-22", priority: "High", domain: "Kairos", status: "Blocked", sprint: true },
  { id: 20, name: "Review Kairos Operating Manual v1.1", due: null, priority: "Medium", domain: "Kairos", status: "Blocked" },
  { id: 21, name: "Sign up for ElevenLabs free tier + get API key", due: null, priority: "High", domain: "Kairos", status: "Done" },
  { id: 22, name: "Follow Up with Elise Hayes on Enrollment Dates", due: null, priority: "High", domain: "School", status: "Done" },
  { id: 23, name: "Monitor BRUIN Connect Security Alert", due: null, priority: "High", domain: "School", status: "Done" },
  { id: 24, name: "Unlock BRUIN Connect Account", due: null, priority: "High", domain: "School", status: "Done" },
  { id: 25, name: "Renew Veteran Education Form", due: null, priority: "High", domain: "School", status: "Done" },
  { id: 26, name: "Build new ATS-optimized resume", due: null, priority: "High", domain: "Job Search", status: "Done" },
];

const COLORS = {
  "High": "#ef4444",
  "Medium": "#f59e0b",
  "Low": "#22c55e",
  "Kairos": "#8b5cf6",
  "Job Search": "#3b82f6",
  "School": "#f59e0b",
  "Personal": "#06b6d4",
  "Done": "#22c55e",
  "In Progress": "#3b82f6",
  "To Do": "#6b7280",
  "Blocked": "#ef4444",
};

const TODAY = new Date("2026-02-07");

function getDaysUntil(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return Math.ceil((d - TODAY) / (1000 * 60 * 60 * 24));
}

function getUrgencyScore(task) {
  if (task.status === "Done") return -100;
  if (task.status === "Blocked") return -50;
  let score = 0;
  const days = getDaysUntil(task.due);
  if (days !== null) {
    if (days <= 0) score += 100;
    else if (days <= 1) score += 80;
    else if (days <= 3) score += 60;
    else if (days <= 7) score += 40;
    else score += 20;
  }
  if (task.priority === "High") score += 30;
  else if (task.priority === "Medium") score += 15;
  if (task.domain === "Kairos") score += 10;
  if (task.status === "In Progress") score += 20;
  return score;
}

function StatusBadge({ status }) {
  const styles = {
    "Done": "bg-green-900 text-green-300 border-green-700",
    "In Progress": "bg-blue-900 text-blue-300 border-blue-700",
    "To Do": "bg-gray-800 text-gray-300 border-gray-600",
    "Blocked": "bg-red-900 text-red-300 border-red-700",
  };
  return <span className={`text-xs px-2 py-0.5 rounded-full border ${styles[status]}`}>{status}</span>;
}

function PriorityDot({ priority }) {
  const c = priority === "High" ? "bg-red-500" : priority === "Medium" ? "bg-yellow-500" : "bg-green-500";
  return <span className={`inline-block w-2 h-2 rounded-full ${c}`} />;
}

function MetricCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex items-start gap-3">
      <div className={`p-2 rounded-lg ${color}`}>
        <Icon size={20} />
      </div>
      <div>
        <div className="text-2xl font-bold text-white">{value}</div>
        <div className="text-sm text-gray-400">{label}</div>
        {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
      </div>
    </div>
  );
}

function SuggestionCard({ rank, task, reason }) {
  const days = getDaysUntil(task.due);
  const overdue = days !== null && days < 0;
  const dueToday = days === 0;
  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border ${overdue ? "bg-red-950 border-red-800" : dueToday ? "bg-yellow-950 border-yellow-800" : "bg-gray-800 border-gray-700"}`}>
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${rank === 1 ? "bg-red-600 text-white" : rank === 2 ? "bg-orange-600 text-white" : rank === 3 ? "bg-yellow-600 text-black" : "bg-gray-600 text-white"}`}>
        {rank}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <PriorityDot priority={task.priority} />
          <span className="text-sm font-medium text-white truncate">{task.name}</span>
        </div>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className="text-xs px-2 py-0.5 rounded bg-gray-700 text-gray-300">{task.domain}</span>
          <StatusBadge status={task.status} />
          {task.due && (
            <span className={`text-xs ${overdue ? "text-red-400 font-bold" : dueToday ? "text-yellow-400 font-bold" : "text-gray-500"}`}>
              {overdue ? `${Math.abs(days)}d OVERDUE` : dueToday ? "DUE TODAY" : `${days}d left`}
            </span>
          )}
        </div>
        <div className="text-xs text-gray-400 mt-1.5 italic">{reason}</div>
      </div>
    </div>
  );
}

function TimelineRow({ task }) {
  const days = getDaysUntil(task.due);
  if (days === null) return null;
  const maxDays = 30;
  const pos = Math.max(0, Math.min(days, maxDays));
  const pct = (pos / maxDays) * 100;
  const overdue = days < 0;

  return (
    <div className="flex items-center gap-2 py-1.5">
      <div className="w-48 flex-shrink-0 truncate text-xs text-gray-300" title={task.name}>{task.name}</div>
      <div className="flex-1 relative h-6 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`absolute top-0 h-full rounded-full flex items-center justify-end pr-2 text-xs font-bold ${
            overdue ? "bg-red-600 text-white" : task.status === "Done" ? "bg-green-600 text-white" : task.status === "Blocked" ? "bg-red-800 text-red-200" : days <= 1 ? "bg-yellow-600 text-black" : "bg-blue-600 text-white"
          }`}
          style={{ width: `${Math.max(overdue ? 100 : 100 - pct, 8)}%` }}
        >
          {overdue ? "OVERDUE" : days === 0 ? "TODAY" : `${days}d`}
        </div>
      </div>
    </div>
  );
}

export default function SprintDashboard() {
  const [showAllSuggestions, setShowAllSuggestions] = useState(false);
  const [activeView, setActiveView] = useState("overview");
  const [selectedDomain, setSelectedDomain] = useState("All");

  const active = TASKS.filter(t => t.status !== "Done");
  const done = TASKS.filter(t => t.status === "Done");
  const blocked = TASKS.filter(t => t.status === "Blocked");
  const inProgress = TASKS.filter(t => t.status === "In Progress");
  const overdueTasks = active.filter(t => { const d = getDaysUntil(t.due); return d !== null && d < 0; });
  const dueTodayTasks = active.filter(t => getDaysUntil(t.due) === 0);
  const highPriActive = active.filter(t => t.priority === "High" && t.status !== "Blocked");
  const sprintTasks = TASKS.filter(t => t.sprint);
  const sprintDone = sprintTasks.filter(t => t.status === "Done");
  const completionRate = Math.round((done.length / TASKS.length) * 100);

  const ranked = useMemo(() => {
    return [...active].sort((a, b) => getUrgencyScore(b) - getUrgencyScore(a));
  }, []);

  const reasons = useMemo(() => {
    const r = {};
    ranked.forEach(t => {
      const days = getDaysUntil(t.due);
      const parts = [];
      if (days !== null && days < 0) parts.push("OVERDUE");
      else if (days === 0) parts.push("Due today");
      else if (days !== null && days <= 2) parts.push(`Due in ${days}d`);
      if (t.priority === "High") parts.push("high priority");
      if (t.status === "In Progress") parts.push("already started");
      if (t.status === "Blocked") parts.push("blocked \u2014 unblock dependencies first");
      if (t.domain === "Kairos") parts.push("critical path to Amico demo");
      if (t.domain === "Job Search") parts.push("income pipeline");
      if (t.domain === "School") parts.push("GI Bill compliance");
      r[t.id] = parts.join(" \u00b7 ") || "Scheduled";
    });
    return r;
  }, [ranked]);

  const statusData = [
    { name: "Done", value: done.length, fill: COLORS.Done },
    { name: "In Progress", value: inProgress.length, fill: COLORS["In Progress"] },
    { name: "To Do", value: active.filter(t => t.status === "To Do").length, fill: COLORS["To Do"] },
    { name: "Blocked", value: blocked.length, fill: COLORS.Blocked },
  ];

  const domainData = [
    { name: "Kairos", value: TASKS.filter(t => t.domain === "Kairos").length, fill: COLORS.Kairos },
    { name: "Job Search", value: TASKS.filter(t => t.domain === "Job Search").length, fill: COLORS["Job Search"] },
    { name: "School", value: TASKS.filter(t => t.domain === "School").length, fill: COLORS.School },
    { name: "Personal", value: TASKS.filter(t => t.domain === "Personal").length, fill: COLORS.Personal },
  ];

  const priorityByDomain = ["Kairos", "Job Search", "School", "Personal"].map(d => ({
    domain: d,
    High: TASKS.filter(t => t.domain === d && t.priority === "High" && t.status !== "Done").length,
    Medium: TASKS.filter(t => t.domain === d && t.priority === "Medium" && t.status !== "Done").length,
    Done: TASKS.filter(t => t.domain === d && t.status === "Done").length,
  }));

  const domains = ["All", "Kairos", "Job Search", "School", "Personal"];
  const filteredActive = selectedDomain === "All" ? active : active.filter(t => t.domain === selectedDomain);

  const visibleSuggestions = showAllSuggestions ? ranked : ranked.slice(0, 5);

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <Target size={28} className="text-purple-400" />
          <h1 className="text-2xl font-bold">Mission Control</h1>
        </div>
        <p className="text-gray-500 text-sm">Lawrence Magee &middot; Sprint Feb 7 &ndash; Mar 6 &middot; Kairos MVP + Job Search</p>
      </div>

      {/* Alert Banner */}
      {(overdueTasks.length > 0 || dueTodayTasks.length > 0) && (
        <div className={`mb-4 p-3 rounded-lg border flex items-start gap-2 ${overdueTasks.length > 0 ? "bg-red-950 border-red-800" : "bg-yellow-950 border-yellow-800"}`}>
          <AlertTriangle size={18} className={overdueTasks.length > 0 ? "text-red-400 mt-0.5" : "text-yellow-400 mt-0.5"} />
          <div className="text-sm">
            {overdueTasks.length > 0 && <span className="text-red-300 font-bold">{overdueTasks.length} overdue task{overdueTasks.length > 1 ? "s" : ""}. </span>}
            {dueTodayTasks.length > 0 && <span className="text-yellow-300 font-bold">{dueTodayTasks.length} due today. </span>}
            <span className="text-gray-400">Focus on these first.</span>
          </div>
        </div>
      )}

      {/* Nav */}
      <div className="flex gap-1 mb-6 bg-gray-900 rounded-lg p-1 w-fit">
        {["overview", "sprint", "timeline"].map(v => (
          <button key={v} onClick={() => setActiveView(v)} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${activeView === v ? "bg-purple-600 text-white" : "text-gray-400 hover:text-white"}`}>
            {v.charAt(0).toUpperCase() + v.slice(1)}
          </button>
        ))}
      </div>

      {activeView === "overview" && (
        <>
          {/* Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <MetricCard icon={CheckCircle} label="Completed" value={`${done.length}/${TASKS.length}`} sub={`${completionRate}% done`} color="bg-green-900 text-green-400" />
            <MetricCard icon={Clock} label="In Progress" value={inProgress.length} sub={`${highPriActive.length} high priority active`} color="bg-blue-900 text-blue-400" />
            <MetricCard icon={AlertTriangle} label="Blocked" value={blocked.length} sub="Waiting on dependencies" color="bg-red-900 text-red-400" />
            <MetricCard icon={Zap} label="Due This Week" value={active.filter(t => { const d = getDaysUntil(t.due); return d !== null && d >= 0 && d <= 7; }).length} sub={`${dueTodayTasks.length} due today`} color="bg-yellow-900 text-yellow-400" />
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-gray-400 mb-3">By Status</h3>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={statusData} dataKey="value" cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={3}>
                    {statusData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8 }} itemStyle={{ color: "#fff" }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-gray-400 mb-3">By Domain</h3>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={domainData} dataKey="value" cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={3}>
                    {domainData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8 }} itemStyle={{ color: "#fff" }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-gray-400 mb-3">Active by Domain & Priority</h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={priorityByDomain} layout="vertical">
                  <XAxis type="number" tick={{ fill: "#9ca3af", fontSize: 11 }} />
                  <YAxis dataKey="domain" type="category" width={75} tick={{ fill: "#9ca3af", fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8 }} itemStyle={{ color: "#fff" }} />
                  <Bar dataKey="High" stackId="a" fill="#ef4444" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="Medium" stackId="a" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* AI Suggestions */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Zap size={16} className="text-purple-400" />
              <h3 className="text-sm font-semibold text-gray-400">ATTACK ORDER — What to Tackle First</h3>
            </div>
            <div className="space-y-2">
              {visibleSuggestions.map((t, i) => (
                <SuggestionCard key={t.id} rank={i + 1} task={t} reason={reasons[t.id]} />
              ))}
            </div>
            {ranked.length > 5 && (
              <button onClick={() => setShowAllSuggestions(!showAllSuggestions)} className="mt-3 flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300">
                {showAllSuggestions ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                {showAllSuggestions ? "Show less" : `Show all ${ranked.length} tasks`}
              </button>
            )}
          </div>

          {/* Task List by Domain */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-400">Active Tasks</h3>
              <div className="flex gap-1">
                {domains.map(d => (
                  <button key={d} onClick={() => setSelectedDomain(d)} className={`px-2 py-1 text-xs rounded-md ${selectedDomain === d ? "bg-purple-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"}`}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              {filteredActive.sort((a, b) => {
                const da = getDaysUntil(a.due);
                const db = getDaysUntil(b.due);
                if (da === null && db === null) return 0;
                if (da === null) return 1;
                if (db === null) return -1;
                return da - db;
              }).map(t => {
                const days = getDaysUntil(t.due);
                return (
                  <div key={t.id} className="flex items-center gap-2 py-2 px-2 rounded-lg hover:bg-gray-800 transition-colors">
                    <PriorityDot priority={t.priority} />
                    <span className="flex-1 text-sm text-gray-200 truncate">{t.name}</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-400 flex-shrink-0" style={{ color: COLORS[t.domain] }}>{t.domain}</span>
                    <StatusBadge status={t.status} />
                    {days !== null && (
                      <span className={`text-xs flex-shrink-0 w-16 text-right ${days < 0 ? "text-red-400 font-bold" : days === 0 ? "text-yellow-400 font-bold" : days <= 3 ? "text-orange-400" : "text-gray-500"}`}>
                        {days < 0 ? `${Math.abs(days)}d over` : days === 0 ? "Today" : `${days}d`}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {activeView === "sprint" && (
        <div className="space-y-4">
          {/* Sprint Progress */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Flag size={16} className="text-purple-400" />
                <h3 className="text-sm font-semibold text-gray-400">KAIROS MVP SPRINT</h3>
              </div>
              <span className="text-xs text-gray-500">Feb 7 &rarr; Mar 6 (28 days)</span>
            </div>

            {/* Sprint progress bar */}
            <div className="mb-4">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>{sprintDone.length}/{sprintTasks.length} tasks</span>
                <span>{Math.round((sprintDone.length / sprintTasks.length) * 100)}%</span>
              </div>
              <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-purple-600 to-purple-400 rounded-full transition-all" style={{ width: `${(sprintDone.length / sprintTasks.length) * 100}%` }} />
              </div>
            </div>

            {/* Sprint milestones */}
            <div className="space-y-2">
              {sprintTasks.sort((a, b) => {
                if (!a.due) return 1; if (!b.due) return -1;
                return new Date(a.due) - new Date(b.due);
              }).map(t => {
                const days = getDaysUntil(t.due);
                return (
                  <div key={t.id} className={`flex items-center gap-3 p-3 rounded-lg border ${t.status === "Done" ? "bg-green-950 border-green-800" : t.status === "Blocked" ? "bg-red-950 border-red-800" : t.status === "In Progress" ? "bg-blue-950 border-blue-800" : "bg-gray-800 border-gray-700"}`}>
                    {t.status === "Done" ? <CheckCircle size={16} className="text-green-400" /> :
                     t.status === "Blocked" ? <AlertTriangle size={16} className="text-red-400" /> :
                     t.status === "In Progress" ? <Clock size={16} className="text-blue-400" /> :
                     <div className="w-4 h-4 rounded-full border-2 border-gray-600" />}
                    <div className="flex-1">
                      <div className="text-sm text-white">{t.name}</div>
                      <div className="text-xs text-gray-500">{t.due ? new Date(t.due).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "No date"} {days !== null ? `(${days}d)` : ""}</div>
                    </div>
                    <StatusBadge status={t.status} />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sprint Dependencies */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-400 mb-3">Critical Path to Demo</h3>
            <div className="flex items-center gap-2 flex-wrap">
              {[
                { label: "Fix Mic", done: false, active: true },
                { label: "ElevenLabs Provider", done: false, blocked: true },
                { label: "Wire E2E", done: false, blocked: true },
                { label: "Record Demo", done: false },
                { label: "Demo to Amico", done: false },
              ].map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${s.done ? "bg-green-900 border-green-700 text-green-300" : s.active ? "bg-blue-900 border-blue-700 text-blue-300 ring-2 ring-blue-500" : s.blocked ? "bg-red-900 border-red-700 text-red-300" : "bg-gray-800 border-gray-700 text-gray-400"}`}>
                    {s.label}
                  </div>
                  {i < 4 && <span className="text-gray-600">&rarr;</span>}
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-3">Mic fix unblocks ElevenLabs &rarr; which unblocks E2E testing &rarr; which unblocks demo recording &rarr; which enables the Amico pitch. This is your $3-10M path.</p>
          </div>
        </div>
      )}

      {activeView === "timeline" && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <Calendar size={16} className="text-purple-400" />
            <h3 className="text-sm font-semibold text-gray-400">30-DAY TIMELINE</h3>
            <span className="text-xs text-gray-600 ml-auto">Feb 7 &rarr; Mar 8</span>
          </div>
          {/* Timeline scale */}
          <div className="flex items-center gap-2 mb-2 pl-48">
            <div className="flex-1 flex justify-between text-xs text-gray-600">
              <span>Today</span>
              <span>1 wk</span>
              <span>2 wk</span>
              <span>3 wk</span>
              <span>4 wk</span>
            </div>
          </div>
          <div className="space-y-0.5">
            {active.filter(t => t.due).sort((a, b) => new Date(a.due) - new Date(b.due)).map(t => (
              <TimelineRow key={t.id} task={t} />
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-6 text-center text-xs text-gray-700">
        Kairos Mission Control &middot; Last synced Feb 7, 2026 &middot; Powered by Claude
      </div>
    </div>
  );
}
