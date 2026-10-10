import { Check, Link2, LogOut, UsersRound } from 'lucide-react';
import Brand from '../../components/Brand.jsx';
import ConnectionBadge from '../../components/ConnectionBadge.jsx';
import { formatRoomCode } from '../../utils/formatters.js';

export default function RoomTopBar({ roomId, connection, participantCount, copied, onInvite, onLeave, onToggleRail, railOpen }) {
  return (
    <header className="topbar">
      <Brand />
      <div className="topbar__room">
        <span className="topbar__label">Room</span>
        <span className="topbar__code" translate="no">{formatRoomCode(roomId)}</span>
      </div>
      <ConnectionBadge status={connection} />
      <div className="topbar__spacer" />
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
    </header>
  );
}
