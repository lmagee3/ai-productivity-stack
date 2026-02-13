type ChatBubbleProps = {
  role: 'user' | 'assistant';
  content: string;
  routeTo?: string;
  error?: boolean;
  isConsecutive?: boolean;
};

export function ChatBubble({ role, content, routeTo, error, isConsecutive }: ChatBubbleProps) {
  return (
    <div
      className={`chat-bubble chat-bubble-${role} ${isConsecutive ? 'consecutive' : ''} ${error ? 'error' : ''}`}
    >
      {routeTo && role === 'assistant' && (
        <span className="route-badge">
          {routeTo === 'local_fast'
            ? 'FAST'
            : routeTo === 'local_deep'
            ? 'DEEP'
            : routeTo === 'cloud_pending_approval'
            ? 'CLOUD PENDING'
            : routeTo.toUpperCase()}
        </span>
      )}
      <p>{content}</p>
      {error && (
        <button className="chat-retry-button" onClick={() => window.location.reload()}>
          Retry
        </button>
      )}
    </div>
  );
}
