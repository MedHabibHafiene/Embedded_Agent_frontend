import { useEffect, useRef, useState, KeyboardEvent } from 'react';
import {
  MessageCircle, Send, Loader2, BookOpen, Trash2, AlertCircle, User, Bot, History, X
} from 'lucide-react';
import type { ChatSessionSummary } from '../types/firmware';
import './ChatPanel.css';

/** One rendered chat turn; assistant turns carry their RAG sources. */
export interface ChatUiMessage {
  role: 'user' | 'assistant';
  content: string;
  sources?: string[];
}

interface ChatPanelProps {
  messages: ChatUiMessage[];
  loading: boolean;
  error: string | null;
  onSend: (message: string) => void;
  onClear: () => void;
  /** Stored chat-log sessions (empty when persistence is off). */
  sessions?: ChatSessionSummary[];
  sessionsError?: string | null;
  activeSessionId?: string | null;
  onLoadSession?: (sessionId: string) => void;
  onDeleteSession?: (sessionId: string) => void;
}

export function ChatPanel({
  messages,
  loading,
  error,
  onSend,
  onClear,
  sessions = [],
  sessionsError = null,
  activeSessionId = null,
  onLoadSession,
  onDeleteSession,
}: ChatPanelProps) {
  const [input, setInput] = useState('');
  const [showSources, setShowSources] = useState<Record<number, boolean>>({});
  const [showSessions, setShowSessions] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, loading]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const submit = () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    onSend(text);
  };

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <div className="chat-header-left">
          <MessageCircle className="icon" aria-hidden="true" />
          <div>
            <span className="chat-title">Documentation Chat</span>
            <span className="chat-subtitle">RAG-grounded Q&A over the board's docs</span>
          </div>
        </div>
        <div className="chat-header-right">
          <span className="badge badge-neutral">{Math.max(0, messages.length - 1)} turns remembered</span>
          {onLoadSession && (
            <button
              className="icon-btn"
              onClick={() => setShowSessions(prev => !prev)}
              aria-label="Chat history"
              aria-expanded={showSessions}
              title="Previous conversations"
            >
              <History className="icon" aria-hidden="true" />
            </button>
          )}
          {messages.length > 0 && (
            <button
              className="icon-btn"
              onClick={onClear}
              aria-label="Start a new conversation"
              title="New conversation"
            >
              <Trash2 className="icon" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {showSessions && (
        <div className="chat-sessions" role="list" aria-label="Previous conversations">
          <div className="chat-sessions-header">
            <span>Previous conversations</span>
            <button
              className="icon-btn"
              onClick={() => setShowSessions(false)}
              aria-label="Close history"
            >
              <X className="icon" aria-hidden="true" />
            </button>
          </div>
          {sessionsError && (
            <p className="chat-sessions-error" role="alert">{sessionsError}</p>
          )}
          {!sessionsError && sessions.length === 0 && (
            <p className="chat-sessions-empty">No stored conversations yet.</p>
          )}
          {sessions.map(session => (
            <div
              key={session.id}
              role="listitem"
              className={`chat-session-item${session.id === activeSessionId ? ' active' : ''}`}
            >
              <button
                className="chat-session-load"
                onClick={() => {
                  onLoadSession?.(session.id);
                  setShowSessions(false);
                }}
                title={`${new Date(session.updated_at).toLocaleString()} — ${session.message_count} messages`}
              >
                <span className="chat-session-title">{session.title}</span>
                <span className="chat-session-meta">
                  {new Date(session.updated_at).toLocaleString()} · {session.message_count} msg
                </span>
              </button>
              {onDeleteSession && (
                <button
                  className="icon-btn chat-session-delete"
                  onClick={() => onDeleteSession(session.id)}
                  aria-label={`Delete conversation "${session.title}"`}
                  title="Delete conversation"
                >
                  <Trash2 className="icon" aria-hidden="true" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="chat-messages" role="log" aria-live="polite">
        {messages.length === 0 && (
          <div className="chat-empty">
            <BookOpen className="icon" aria-hidden="true" />
            <p>Ask anything about the STM32F4-Discovery board</p>
            <span className="hint">
              GPIO, clocks, HAL drivers, interrupts, timers… answers are grounded in the
              indexed board documentation.
            </span>
          </div>
        )}

        {messages.map((message, index) => (
          <div key={index} className={`chat-message ${message.role}`}>
            <div className="message-avatar">
              {message.role === 'user' ? <User className="icon" /> : <Bot className="icon" />}
            </div>
            <div className="message-body">
              <div className="message-content">{message.content}</div>
              {message.role === 'assistant' && message.sources && message.sources.length > 0 && (
                <div className="message-sources">
                  <button
                    className="sources-toggle"
                    onClick={() => setShowSources(prev => ({ ...prev, [index]: !prev[index] }))}
                    aria-expanded={!!showSources[index]}
                  >
                    <BookOpen className="icon" aria-hidden="true" />
                    Sources ({message.sources.length})
                  </button>
                  {showSources[index] && (
                    <ul className="sources-list">
                      {message.sources.map((source, i) => (
                        <li key={i} className="source-item" title={source}>
                          {source}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="chat-message assistant">
            <div className="message-avatar">
              <Bot className="icon" />
            </div>
            <div className="message-body">
              <div className="message-content chat-thinking">
                <Loader2 className="icon spinner" aria-hidden="true" />
                Searching the docs…
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {error && (
        <div className="chat-error" role="alert">
          <AlertCircle className="icon" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      <div className="chat-input-area">
        <textarea
          ref={inputRef}
          className="input chat-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about the board… (Enter to send, Shift+Enter for a new line)"
          disabled={loading}
          rows={Math.min(4, Math.max(1, input.split('\n').length))}
          aria-label="Chat message"
        />
        <button
          type="button"
          className="btn btn-primary chat-send-btn"
          onClick={submit}
          disabled={loading || !input.trim()}
          aria-label="Send message"
        >
          {loading ? (
            <Loader2 className="icon spinner" aria-hidden="true" />
          ) : (
            <Send className="icon" aria-hidden="true" />
          )}
        </button>
      </div>
    </div>
  );
}
