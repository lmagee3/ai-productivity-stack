import { useState, useRef, useEffect } from 'react';
import { ChatBubble } from './chat/ChatBubble';
import { ChatComposer } from './chat/ChatComposer';
import { QuickActions } from './chat/QuickActions';
import { TimestampDivider } from './chat/TimestampDivider';

export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  route_to?: string;
  timestamp?: string;
  error?: boolean;
};

type ChatPanelProps = {
  messages: ChatMessage[];
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: () => void | Promise<void>;
  onScanTrigger: () => void;
  onSyncTrigger: () => void;
  isSubmitting?: boolean;
  isScanning?: boolean;
  scanElapsedS?: number;
};

export function ChatPanel({
  messages,
  input,
  onInputChange,
  onSubmit,
  onScanTrigger,
  onSyncTrigger,
  isSubmitting = false,
  isScanning = false,
  scanElapsedS = 0,
}: ChatPanelProps) {
  const messageListRef = useRef<HTMLDivElement>(null);
  const [showScrollPill, setShowScrollPill] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);

  // Auto-scroll logic
  useEffect(() => {
    if (!messageListRef.current) return;
    const container = messageListRef.current;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;

    if (autoScroll && isNearBottom) {
      container.scrollTop = container.scrollHeight;
      setShowScrollPill(false);
    } else if (!isNearBottom) {
      setShowScrollPill(true);
    }
  }, [messages, autoScroll]);

  const handleScroll = () => {
    if (!messageListRef.current) return;
    const container = messageListRef.current;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    setAutoScroll(isNearBottom);
    setShowScrollPill(!isNearBottom && messages.length > 0);
  };

  const scrollToBottom = () => {
    if (messageListRef.current) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
      setAutoScroll(true);
      setShowScrollPill(false);
    }
  };

  // Group messages by timestamp (5+ min gaps)
  const groupedMessages = messages.reduce((acc, msg, idx) => {
    const currentTime = msg.timestamp ? new Date(msg.timestamp).getTime() : Date.now();
    const prevTime = idx > 0 && messages[idx - 1].timestamp
      ? new Date(messages[idx - 1].timestamp!).getTime()
      : currentTime;

    const gap = (currentTime - prevTime) / 1000 / 60; // minutes

    if (gap >= 5 || idx === 0) {
      acc.push({ timestamp: msg.timestamp || new Date().toISOString(), messages: [msg] });
    } else {
      acc[acc.length - 1].messages.push(msg);
    }

    return acc;
  }, [] as Array<{ timestamp: string; messages: ChatMessage[] }>);

  return (
    <div className="chat-panel-container">
      <div className="chat-header">
        <span>Local Brain Chat</span>
      </div>

      <div
        ref={messageListRef}
        className="chat-message-list"
        onScroll={handleScroll}
      >
        {messages.length === 0 ? (
          <div className="chat-empty-state">
            <p className="meta">Ask MAGE to scan your desktop or plan your next move.</p>
          </div>
        ) : (
          groupedMessages.map((group, groupIdx) => (
            <div key={groupIdx}>
              <TimestampDivider timestamp={group.timestamp} />
              {group.messages.map((msg, msgIdx) => (
                <ChatBubble
                  key={`${groupIdx}-${msgIdx}`}
                  role={msg.role}
                  content={msg.content}
                  routeTo={msg.route_to}
                  error={msg.error}
                  isConsecutive={msgIdx > 0 && group.messages[msgIdx - 1].role === msg.role}
                />
              ))}
            </div>
          ))
        )}

        {isSubmitting && (
          <div className="chat-typing-indicator">
            <div className="typing-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        )}
      </div>

      {showScrollPill && (
        <button className="chat-scroll-pill" onClick={scrollToBottom}>
          New messages ↓
        </button>
      )}

      <QuickActions
        onScan={onScanTrigger}
        onSync={onSyncTrigger}
        isScanning={isScanning}
        scanElapsedS={scanElapsedS}
      />

      <ChatComposer
        value={input}
        onChange={onInputChange}
        onSubmit={onSubmit}
        disabled={isSubmitting}
      />
    </div>
  );
}
