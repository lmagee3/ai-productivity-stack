import { useState } from 'react';
import { sendChatMessage, ingestWeb, ingestEmail } from '../chat';
import type { ChatMessage } from '../components/ChatPanel';

const scanTriggers = /scan|files|file|folder|desktop|check my stuff|check my files|look through/i;

type UseChatOptions = {
  onScanTrigger?: () => void;
  onActivity?: (message: string) => void;
};

export function useChat(options: UseChatOptions = {}) {
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');

  const handleSubmit = async () => {
    if (!input.trim()) return;

    const nextMessage = input.trim();
    const wantsScan = scanTriggers.test(nextMessage);

    setMessages((prev) => [...prev, { role: 'user', content: nextMessage }]);
    setInput('');

    // Check for URL ingest
    const urlMatch = nextMessage.match(/https?:\/\/\S+/i);
    if (urlMatch) {
      try {
        const ingest = await ingestWeb(urlMatch[0]);
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: `Web ingest complete: ${ingest.summary}`, route_to: 'tool' },
        ]);
        options.onActivity?.('Web ingest complete.');
        return;
      } catch {
        options.onActivity?.('Web ingest failed.');
      }
    }

    // Check for email ingest
    if (nextMessage.toLowerCase().startsWith('email:')) {
      const body = nextMessage.slice(6).trim();
      try {
        const ingest = await ingestEmail('Email from chat', body);
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: `Email ingest complete: ${ingest.summary}`, route_to: 'tool' },
        ]);
        options.onActivity?.('Email ingest complete.');
      } catch {
        options.onActivity?.('Email ingest failed.');
      }
      return;
    }

    // Check for scan trigger
    if (wantsScan) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Opening scan options. Choose Desktop or a folder.', route_to: 'tool' },
      ]);
      options.onScanTrigger?.();
      return;
    }

    // Regular chat
    try {
      const response = await sendChatMessage(nextMessage, sessionId ?? undefined);
      setSessionId(response.session_id);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: response.assistant_message, route_to: response.route_to },
      ]);
    } catch {
      options.onActivity?.('Chat error: failed to reach backend.');
    }
  };

  return {
    sessionId,
    messages,
    input,
    setInput,
    handleSubmit,
  };
}
