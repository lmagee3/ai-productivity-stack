import React from 'react';

type OverviewPrefs = {
  metrics: boolean;
  charts: boolean;
  attack: boolean;
  chat: boolean;
};

type BriefPrefs = {
  news: boolean;
  tasks: boolean;
  scan: boolean;
};

type Props = {
  open: boolean;
  overviewPrefs: OverviewPrefs;
  briefPrefs: BriefPrefs;
  onClose: () => void;
  onOverviewChange: (next: OverviewPrefs) => void;
  onBriefChange: (next: BriefPrefs) => void;
};

export function SettingsModal({
  open,
  overviewPrefs,
  briefPrefs,
  onClose,
  onOverviewChange,
  onBriefChange,
}: Props) {
  if (!open) return null;

  return (
    <div className="scan-modal-backdrop">
      <div className="scan-modal">
        <h3>Dashboard Settings</h3>
        <p className="meta">Toggle sections on Mission Control and Daily Brief.</p>
        <div className="settings-grid">
          <div>
            <div className="settings-title">Mission Control</div>
            <label className="settings-row">
              <input
                type="checkbox"
                checked={overviewPrefs.metrics}
                onChange={(e) => onOverviewChange({ ...overviewPrefs, metrics: e.target.checked })}
              />
              Metrics
            </label>
            <label className="settings-row">
              <input
                type="checkbox"
                checked={overviewPrefs.charts}
                onChange={(e) => onOverviewChange({ ...overviewPrefs, charts: e.target.checked })}
              />
              Charts
            </label>
            <label className="settings-row">
              <input
                type="checkbox"
                checked={overviewPrefs.attack}
                onChange={(e) => onOverviewChange({ ...overviewPrefs, attack: e.target.checked })}
              />
              Attack Order
            </label>
            <label className="settings-row">
              <input
                type="checkbox"
                checked={overviewPrefs.chat}
                onChange={(e) => onOverviewChange({ ...overviewPrefs, chat: e.target.checked })}
              />
              Chat
            </label>
          </div>
          <div>
            <div className="settings-title">Daily Brief</div>
            <label className="settings-row">
              <input
                type="checkbox"
                checked={briefPrefs.news}
                onChange={(e) => onBriefChange({ ...briefPrefs, news: e.target.checked })}
              />
              News
            </label>
            <label className="settings-row">
              <input
                type="checkbox"
                checked={briefPrefs.tasks}
                onChange={(e) => onBriefChange({ ...briefPrefs, tasks: e.target.checked })}
              />
              Tasks
            </label>
            <label className="settings-row">
              <input
                type="checkbox"
                checked={briefPrefs.scan}
                onChange={(e) => onBriefChange({ ...briefPrefs, scan: e.target.checked })}
              />
              Scan Signals
            </label>
          </div>
        </div>
        <button className="scan-modal-cancel" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
