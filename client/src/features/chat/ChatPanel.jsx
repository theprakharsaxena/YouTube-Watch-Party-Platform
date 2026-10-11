import { useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import Avatar from '../../components/Avatar.jsx';
import RoleBadge from '../../components/RoleBadge.jsx';

function formatTime(timestamp) {
  if (!timestamp) return '';
  const d = new Date(timestamp);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function ChatPanel({ messages, meId, onSendMessage, isViewer = false }) {
  const [text, setText] = useState('');
  const messagesContainerRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages.length]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isViewer) return;
    const trimmed = text.trim();
    if (!trimmed) return;
    onSendMessage(trimmed);
    setText('');
    inputRef.current?.focus({ preventScroll: true });
  };

  return (
    <div className="chat-panel">
      <div className="chat-panel__messages" ref={messagesContainerRef} tabIndex={0} aria-label="Chat message history">
        {messages.length === 0 ? (
          <div className="chat-panel__empty">
            <p>No messages yet.</p>
            <span>Say hi to everyone watching along!</span>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === meId;
            return (
              <div
                key={msg.id}
                className={`chat-msg${isMe ? ' chat-msg--me' : ''}${msg.type === 'system' ? ' chat-msg--system' : ''}`}
              >
                {!isMe && msg.type !== 'system' && (
                  <Avatar name={msg.senderName} size={24} />
                )}
                <div className="chat-msg__bubble">
                  {msg.type !== 'system' && (
                    <div className="chat-msg__header">
                      <span className="chat-msg__name">
                        {msg.senderName}
                        {isMe && <span className="chat-msg__you"> (you)</span>}
                      </span>
                      {msg.senderRole && <RoleBadge role={msg.senderRole} />}
                      <time className="chat-msg__time">{formatTime(msg.timestamp)}</time>
                    </div>
                  )}
                  <p className="chat-msg__text">{msg.text}</p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {isViewer && (
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center', padding: '4px 8px 0', opacity: 0.85 }}>
          Viewers can read messages. Log in to join the conversation.
        </div>
      )}

      <form className="chat-panel__form" onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          type="text"
          className="chat-panel__input"
          placeholder={isViewer ? 'Log in to join the chat…' : 'Send a message…'}
          maxLength={500}
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={isViewer}
          title={isViewer ? 'Log in to participate in the chat' : undefined}
        />
        <button
          type="submit"
          className="icon-btn chat-panel__send"
          disabled={isViewer || !text.trim()}
          aria-label="Send message"
          title={isViewer ? 'Log in to participate in the chat' : 'Send message'}
        >
          <Send size={16} aria-hidden="true" />
        </button>
      </form>
    </div>
  );
}

