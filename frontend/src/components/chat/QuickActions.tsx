type QuickActionsProps = {
  onScan: () => void;
  onSync: () => void;
  isScanning?: boolean;
  scanElapsedS?: number;
};

export function QuickActions({ onScan, onSync, isScanning, scanElapsedS }: QuickActionsProps) {
  return (
    <div className="chat-quick-actions">
      <button className="quick-action-pill" onClick={onScan} disabled={isScanning}>
        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
          <path d="M4 2h8a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V4a2 2 0 012-2zm0 1a1 1 0 00-1 1v8a1 1 0 001 1h8a1 1 0 001-1V4a1 1 0 00-1-1H4z" />
          <path d="M6 6h4v4H6z" />
        </svg>
        {isScanning ? `Scanning (${scanElapsedS}s)` : 'Scan'}
      </button>
      <button className="quick-action-pill" onClick={onSync}>
        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 3a5 5 0 104.546 2.914.5.5 0 01.908-.417A6 6 0 118 2v1z" />
          <path d="M8 4.466V.534a.25.25 0 01.41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 018 4.466z" />
        </svg>
        Sync
      </button>
    </div>
  );
}
