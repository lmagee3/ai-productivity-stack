import { useState, useRef, useEffect, KeyboardEvent } from 'react';

type ChatComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void | Promise<void>;
  disabled?: boolean;
};

export function ChatComposer({ value, onChange, onSubmit, disabled }: ChatComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && value.trim()) {
        void onSubmit();
      }
    }
  };

  // Auto-resize textarea (max 4 lines)
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      const maxHeight = 20 * 4 + 16; // 4 lines + padding
      textareaRef.current.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
    }
  }, [value]);

  const canSend = !disabled && value.trim().length > 0;

  return (
    <div className="chat-composer">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask MAGE..."
        disabled={disabled}
        rows={1}
      />
      <button
        className={`chat-send-button ${canSend ? 'active' : ''}`}
        onClick={() => void onSubmit()}
        disabled={!canSend}
        aria-label="Send message"
      >
        {disabled ? (
          <svg className="spinner" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" strokeWidth="3" fill="none" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L12 14M12 2L7 7M12 2L17 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <circle cx="12" cy="12" r="10" strokeWidth="2" fill="none" stroke="currentColor" />
          </svg>
        )}
      </button>
    </div>
  );
}
