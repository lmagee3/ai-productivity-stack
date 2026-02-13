import { useState } from 'react';
import { sendChatMessage, ingestWeb, ingestEmail } from '../chat';
import type { ChatMessage } from '../components/ChatPanel';

const scanTriggers = /scan|files|file|folder|desktop|check my stuff|check my files|look through/i;

type UseChatOptions = {
  onScanTrigger?: () => void;
  onSyncTrigger?: () => void;
  onActivity?: (message: string) => void;
};

export function useChat(options: UseChatOptions = {}) {
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const addMessage = (msg: Omit<ChatMessage, 'timestamp'>) => {
    setMessages((prev) => [...prev, { ...msg, timestamp: new Date().toISOString() }]);
  };

  const handleSubmit = async () => {
    if (!input.trim() || isSubmitting) return;

    const nextMessage = input.trim();
    const wantsScan = scanTriggers.test(nextMessage);

    addMessage({ role: 'user', content: nextMessage });
    setInput('');
    setIsSubmitting(true);

    try {
      // Check for URL ingest
      const urlMatch = nextMessage.match(/https?:\/\/\S+/i);
      if (urlMatch) {
        const ingest = await ingestWeb(urlMatch[0]);
        addMessage({
          role: 'assistant',
          content: `Web ingest complete: ${ingest.summary}`,
          route_to: 'tool',
        });
        options.onActivity?.('Web ingest complete.');
        return;
      }

      // Check for email ingest
      if (nextMessage.toLowerCase().startsWith('email:')) {
        const body = nextMessage.slice(6).trim();
        const ingest = await ingestEmail('Email from chat', body);
        addMessage({
          role: 'assistant',
          content: `Email ingest complete: ${ingest.summary}`,
          route_to: 'tool',
        });
        options.onActivity?.('Email ingest complete.');
        return;
      }

      // Check for scan trigger
      if (wantsScan) {
        addMessage({
          role: 'assistant',
          content: 'Opening scan options. Choose Desktop or a folder.',
          route_to: 'tool',
        });
        options.onScanTrigger?.();
        return;
      }

      // Regular chat
      const response = await sendChatMessage(nextMessage, sessionId ?? undefined);
      setSessionId(response.session_id);
      addMessage({
        role: 'assistant',
        content: response.assistant_message,
        route_to: response.route_to,
      });
    } catch (error) {
      addMessage({
        role: 'assistant',
        content: 'Chat error: failed to reach backend.',
        error: true,
      });
      options.onActivity?.('Chat error: failed to reach backend.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    sessionId,
    messages,
    input,
    isSubmitting,
    setInput,
    handleSubmit,
  };
}
