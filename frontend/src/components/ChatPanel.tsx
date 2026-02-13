import { useState } from 'react';

export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  route_to?: string;
};

type ChatPanelProps = {
  messages: ChatMessage[];
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: () => void | Promise<void>;
  isScanning?: boolean;
  scanElapsedS?: number;
  scanSummary?: string | null;
};

export function ChatPanel({
  messages,
  input,
  onInputChange,
  onSubmit,
  isScanning = false,
  scanElapsedS = 0,
  scanSummary = null,
}: ChatPanelProps) {
  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      void onSubmit();
    }
  };

  return (
    <div className="chat-panel chat-panel-stretch">
      <div className="chat-panel-header">Local Brain Chat</div>
      <div className="chat-window chat-window-tall">
        {messages.length === 0 ? (
          <p className="meta">Ask module_09 to scan your desktop or plan your next move.</p>
        ) : (
          messages.map((msg, idx) => (
            <div key={idx} className={`chat-bubble ${msg.role}`}>
              <span className="chat-role">{msg.role}</span>
              {msg.role === 'assistant' && msg.route_to ? (
                <span className="route-badge">
                  {msg.route_to === 'local_fast'
                    ? 'FAST'
                    : msg.route_to === 'local_deep'
                    ? 'DEEP'
                    : msg.route_to === 'cloud_pending_approval'
                    ? 'CLOUD PENDING APPROVAL'
                    : msg.route_to.toUpperCase()}
                </span>
              ) : null}
              <p>{msg.content}</p>
            </div>
          ))
        )}
      </div>
      <div className="chat-actions">
        <input
          value={input}
          onChange={(event) => onInputChange(event.target.value)}
          placeholder="Ask module_09 to scan files, summarize, or plan."
          onKeyDown={handleKeyDown}
        />
        <button onClick={() => void onSubmit()}>Send</button>
      </div>
      {isScanning ? (
        <div className="scan-progress">
          <div className="scan-progress-bar" />
          <div className="meta">Scanning in progress... {scanElapsedS}s elapsed</div>
        </div>
      ) : null}
      {scanSummary ? <div className="chat-meta">{scanSummary}</div> : null}
    </div>
  );
}
