# Chat Refactor Prep — Awaiting Opus Spec

**Status**: Modular components created but NOT wired into App.tsx yet.

**Why**: Opus UI spec will dictate exact component structure. Don't want to refactor twice.

---

## Components Created (Ready to Use)

### 1. `src/components/ChatPanel.tsx`
Extracted chat UI from App.tsx.

**Props:**
```ts
{
  messages: ChatMessage[];
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: () => void | Promise<void>;
  isScanning?: boolean;
  scanElapsedS?: number;
  scanSummary?: string | null;
}
```

**Visual parity**: Uses exact same classNames as current App.tsx inline chat.

---

### 2. `src/hooks/useChat.ts`
Extracted chat logic from App.tsx.

**Returns:**
```ts
{
  sessionId: number | null;
  messages: ChatMessage[];
  input: string;
  setInput: (value: string) => void;
  handleSubmit: () => Promise<void>;
}
```

**Logic preserved:**
- URL ingest detection
- Email ingest (`email:` prefix)
- Scan trigger regex
- Session management
- Error handling

---

## Integration Plan (Post-Opus Spec)

When Opus spec arrives:

1. **If spec matches current chat structure:**
   - Replace App.tsx chat section with `<ChatPanel />` + `useChat` hook
   - Test for visual regression

2. **If spec requires new chat structure:**
   - Use ChatPanel/useChat as reference
   - Build new components per Opus spec
   - Delete unused prep components

---

## Current Chat Location in App.tsx

Lines 633-700+ (approx):
- `<aside className="mission-chat-rail">`
- Chat window, input, actions
- Proposed actions panel

**State dependencies:**
- `messages`, `input`, `sessionId`
- `isScanning`, `scanElapsedS`, `scanSummary`
- `actions` (proposed actions)
- `setActivity` callback

**Integration points:**
- `handleChatSubmit()` function (lines 398-452)
- `syncInbox()` function
- `setShowScanModal(true)` trigger

---

## Risk Mitigation

**Why we didn't wire these in yet:**
- Opus might want completely different bubble layout (iOS-style)
- Might want different message flow (auto-scroll, timestamps, typing indicators)
- Might want composer redesign (multi-line, attachments, etc.)
- Current modular components assume current classNames — Opus might want new theme tokens

**Better to wait** than refactor App.tsx twice.

---

## Testing Checklist (When Integrated)

- [ ] Visual regression: chat looks identical pre/post refactor
- [ ] Message send/receive flow
- [ ] URL ingest trigger
- [ ] Email ingest trigger
- [ ] Scan modal trigger
- [ ] Session persistence
- [ ] Error handling (backend down)
- [ ] Keyboard shortcuts (Enter to send)
- [ ] Scroll behavior (auto-scroll to bottom)

---

**Next step**: Receive Opus spec → implement exactly to spec → test → ship.
