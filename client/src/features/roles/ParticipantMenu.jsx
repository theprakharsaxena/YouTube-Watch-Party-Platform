import { useEffect, useRef, useState } from 'react';
import { Crown, Eye, MoreVertical, ShieldCheck, ShieldOff, UserCheck, UserMinus } from 'lucide-react';

/**
 * Host-only per-participant menu. Positioned with `fixed` so the scrolling list can't clip it.
 * Keyboard: Enter/Space opens, Arrow keys move, Escape closes and returns focus.
 */
export default function ParticipantMenu({ participant, onChooseAction }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const buttonRef = useRef(null);
  const menuRef = useRef(null);

  const items = [
    participant.role === 'moderator'
      ? { id: 'demote', label: 'Demote to Participant', icon: ShieldOff }
      : { id: 'promote', label: 'Make Moderator', icon: ShieldCheck },
    participant.role === 'viewer'
      ? { id: 'demote', label: 'Set as Participant', icon: UserCheck }
      : { id: 'set_viewer', label: 'Set as Viewer', icon: Eye },
    { id: 'transfer', label: 'Make Host…', icon: Crown },
    { id: 'remove', label: 'Remove from room…', icon: UserMinus, danger: true },
  ];

  const close = (returnFocus = false) => {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return undefined;
    menuRef.current?.querySelector('button')?.focus();
    const onPointer = (e) => {
      if (!menuRef.current?.contains(e.target) && !buttonRef.current?.contains(e.target)) close();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close(true);
      }
    };
    const dismiss = () => close();
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', dismiss);
    window.addEventListener('scroll', dismiss, true);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('resize', dismiss);
      window.removeEventListener('scroll', dismiss, true);
    };
  }, [open]);

  function toggle() {
    if (!open) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 6, right: Math.max(8, window.innerWidth - rect.right) });
    }
    setOpen((v) => !v);
  }

  function onMenuKeyDown(e) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const buttons = [...menuRef.current.querySelectorAll('button')];
    const index = buttons.indexOf(document.activeElement);
    const next = e.key === 'ArrowDown' ? (index + 1) % buttons.length : (index - 1 + buttons.length) % buttons.length;
    buttons[next].focus();
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="icon-btn icon-btn--small"
        aria-label={`Manage ${participant.name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggle}
      >
        <MoreVertical size={16} aria-hidden="true" />
      </button>
      {open && (
        <div ref={menuRef} role="menu" aria-label={`Actions for ${participant.name}`} className="menu" style={{ top: pos.top, right: pos.right }} onKeyDown={onMenuKeyDown}>
          {items.map(({ id, label, icon: Icon, danger }) => (
            <button
              key={id}
              type="button"
              role="menuitem"
              className={`menu__item${danger ? ' menu__item--danger' : ''}`}
              onClick={() => {
                close();
                onChooseAction(id, participant);
              }}
            >
              <Icon size={16} aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
