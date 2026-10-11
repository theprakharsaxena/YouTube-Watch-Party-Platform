import { useState } from 'react';
import { Check, Copy, Link2, LogOut, User, UsersRound } from 'lucide-react';
import Brand from '../../components/Brand.jsx';
import ConnectionBadge from '../../components/ConnectionBadge.jsx';
import AuthDialog from '../../components/AuthDialog.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../components/Toast.jsx';
import { copyText } from '../../utils/clipboard.js';
import { formatRoomCode } from '../../utils/formatters.js';

export default function RoomTopBar({ roomId, connection, participantCount, copied, onInvite, onLeave, onToggleRail, railOpen }) {
  const { user } = useAuth();
  const toast = useToast();
  const [authOpen, setAuthOpen] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  const handleCopyCode = async () => {
    const code = formatRoomCode(roomId);
    const ok = await copyText(code);
    if (ok) {
      setCodeCopied(true);
      toast.success(`Room code ${code} copied to clipboard!`);
      setTimeout(() => setCodeCopied(false), 2000);
    }
  };

  return (
    <header className="topbar">
      <Brand />
      <button
        type="button"
        className="topbar__room"
        onClick={handleCopyCode}
        title="Click to copy room code"
        aria-label={`Copy room code ${formatRoomCode(roomId)}`}
      >
        <span className="topbar__label">Room</span>
        <span className="topbar__code" translate="no">{formatRoomCode(roomId)}</span>
        {codeCopied ? (
          <span className="topbar__code-copied">
            <Check size={12} aria-hidden="true" />
            <span>Copied!</span>
          </span>
        ) : (
          <Copy size={12} className="topbar__copy-icon" aria-hidden="true" />
        )}
      </button>
      <ConnectionBadge status={connection} />
      <div className="topbar__spacer" />
      {user && !user.isGuest ? (
        <span className="topbar__user" title={`Logged in as ${user.displayName}`} style={{ fontSize: '0.85rem', color: 'var(--amber)', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <User size={14} aria-hidden="true" />
          <span>{user.displayName}</span>
        </span>
      ) : (
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => setAuthOpen(true)}>
          Log in
        </button>
      )}
      <button type="button" className="btn btn--primary btn--sm" onClick={onInvite} id="invite-button">
        {copied ? <Check size={16} aria-hidden="true" /> : <Link2 size={16} aria-hidden="true" />}
        <span>{copied ? 'Link copied' : 'Invite'}</span>
      </button>
      <button
        type="button"
        className="btn btn--secondary btn--sm topbar__people"
        onClick={onToggleRail}
        aria-expanded={railOpen}
        aria-controls="participant-rail"
      >
        <UsersRound size={16} aria-hidden="true" />
        <span>{participantCount}</span>
        <span className="sr-only"> participants</span>
      </button>
      <button type="button" className="icon-btn" aria-label="Leave room" title="Leave room" onClick={onLeave}>
        <LogOut size={18} aria-hidden="true" />
      </button>

      <AuthDialog open={authOpen} onClose={() => setAuthOpen(false)} />
    </header>
  );
}

