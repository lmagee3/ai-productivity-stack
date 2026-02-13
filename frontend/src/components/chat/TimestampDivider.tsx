type TimestampDividerProps = {
  timestamp: string;
};

function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // Today: show time only
  if (diffDays === 0 && date.getDate() === now.getDate()) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }

  // Yesterday
  if (diffDays === 1 || (diffDays === 0 && date.getDate() !== now.getDate())) {
    return 'Yesterday';
  }

  // This week: day name
  if (diffDays < 7) {
    return date.toLocaleDateString('en-US', { weekday: 'long' });
  }

  // Older: full date
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function TimestampDivider({ timestamp }: TimestampDividerProps) {
  return (
    <div className="chat-timestamp-divider">
      <span>{formatTimestamp(timestamp)}</span>
    </div>
  );
}
