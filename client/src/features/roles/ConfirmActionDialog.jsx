import { useState } from 'react';
import Dialog from '../../components/Dialog.jsx';
import Button from '../../components/Button.jsx';

const COPY = {
  remove: (name) => ({
    title: `Remove ${name}?`,
    body: `${name} will be disconnected from the room and won't be able to rejoin with this session.`,
    confirm: 'Remove from room',
    danger: true,
  }),
  transfer: (name) => ({
    title: `Make ${name} the host?`,
    body: `${name} becomes the host and you'll become a moderator. Only the host can manage roles and remove people.`,
    confirm: 'Transfer host',
    danger: false,
  }),
};

/** Confirmation for the two irreversible-ish host actions. `action` = { type, participant } | null */
export default function ConfirmActionDialog({ action, onCancel, onConfirm }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const copy = action ? COPY[action.type](action.participant.name) : null;

  async function confirm() {
    setBusy(true);
    setError('');
    try {
      await onConfirm(action);
    } catch (e) {
      setError(e.message || 'That did not work.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={Boolean(action)} onClose={busy ? () => {} : onCancel} title={copy?.title ?? ''} description={copy?.body} labelledBy="confirm-title">
      {error && <p className="form-alert" role="alert">{error}</p>}
      <div className="dialog__actions">
        <Button variant="ghost" onClick={onCancel} disabled={busy}>Cancel</Button>
        <Button variant={copy?.danger ? 'danger' : 'primary'} loading={busy} onClick={confirm}>{copy?.confirm}</Button>
      </div>
    </Dialog>
  );
}
