import { useEffect, useRef, useState } from 'react';
import { Link2, UsersRound, X } from 'lucide-react';
import Avatar from '../../components/Avatar.jsx';
import RoleBadge from '../../components/RoleBadge.jsx';
import ParticipantMenu from '../roles/ParticipantMenu.jsx';
import ConfirmActionDialog from '../roles/ConfirmActionDialog.jsx';
import { useToast } from '../../components/Toast.jsx';

/**
 * Quiet side rail listing who is here and what each person may do.
 * On narrow screens it becomes a bottom sheet toggled from the top bar.
 */
export default function ParticipantRail({
  participants,
  meId,
  isHost,
  hostConnected,
  open,
  onClose,
  onInvite,
  onAssignRole,
  onRemove,
}) {
  const [pending, setPending] = useState(null);
  const toast = useToast();
  const closeRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    closeRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  function handleChoose(actionId, participant) {
    const fail = (error) => toast.error(error.message || 'That did not work.');
    if (actionId === 'promote') onAssignRole(participant.id, 'moderator').catch(fail);
    else if (actionId === 'demote') onAssignRole(participant.id, 'participant').catch(fail);
    else setPending({ type: actionId, participant });
  }

  async function handleConfirm(action) {
    if (action.type === 'remove') await onRemove(action.participant.id);
    else await onAssignRole(action.participant.id, 'host');
    setPending(null);
  }

  const alone = participants.length <= 1;

  return (
    <>
      <div className={`rail-backdrop${open ? ' is-open' : ''}`} onClick={onClose} aria-hidden="true" />
      <aside className={`rail${open ? ' is-open' : ''}`} aria-label="Participants" id="participant-rail">
        <header className="rail__header">
          <h2 className="rail__title">
            <UsersRound size={16} aria-hidden="true" />
            In the room <span className="rail__count">{participants.length}</span>
          </h2>
          <button ref={closeRef} type="button" className="icon-btn rail__close" aria-label="Close participants" onClick={onClose}>
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        {!hostConnected && (
          <p className="rail__notice" role="status">The host is disconnected. They keep their seat for a short while.</p>
        )}

        <ul className="rail__list">
          {participants.map((person) => {
            const isMe = person.id === meId;
            return (
              <li key={person.id} className={`person${person.connected ? '' : ' person--away'}`}>
                <Avatar name={person.name} dimmed={!person.connected} />
                <div className="person__text">
                  <span className="person__name">
                    {person.name}
                    {isMe && <span className="person__you"> (you)</span>}
                  </span>
                  <span className="person__meta">
                    <RoleBadge role={person.role} />
                    {!person.connected && <span className="person__away">reconnecting…</span>}
                  </span>
                </div>
                {isHost && !isMe && <ParticipantMenu participant={person} onChooseAction={handleChoose} />}
              </li>
            );
          })}
        </ul>

        {alone && (
          <div className="rail__empty">
            <p>It's just you for now.</p>
            <button type="button" className="btn btn--secondary btn--sm" onClick={onInvite}>
              <Link2 size={14} aria-hidden="true" /> Copy invite link
            </button>
          </div>
        )}
      </aside>

      <ConfirmActionDialog action={pending} onCancel={() => setPending(null)} onConfirm={handleConfirm} />
    </>
  );
}
