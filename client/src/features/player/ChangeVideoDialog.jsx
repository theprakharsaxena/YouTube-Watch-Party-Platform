import { useEffect, useState } from 'react';
import { Film } from 'lucide-react';
import Dialog from '../../components/Dialog.jsx';
import Field from '../../components/Field.jsx';
import Button from '../../components/Button.jsx';
import { VIDEO_URL_HINT, validateVideoInput } from '../../utils/youtube.js';

export default function ChangeVideoDialog({
  open,
  onClose,
  onSubmit,
  title = 'Choose a video',
  description = 'Everyone in the room switches to it immediately. It starts paused so you can all get ready.',
  submitLabel = 'Load video',
}) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setValue('');
      setError('');
      setBusy(false);
    }
  }, [open]);

  async function handleSubmit(event) {
    event.preventDefault();
    const message = validateVideoInput(value, { required: true });
    setError(message);
    if (message) return;
    setBusy(true);
    try {
      await onSubmit(value.trim());
      onClose();
    } catch (e) {
      setError(e.message || 'Could not change the video.');
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      labelledBy="change-video-title"
    >
      <form onSubmit={handleSubmit} noValidate className="form-stack">
        <Field
          label="YouTube link"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          error={error}
          hint={VIDEO_URL_HINT}
          inputMode="url"
          autoComplete="off"
          autoFocus
          placeholder="https://youtu.be/…"
        />
        <div className="dialog__actions">
          <Button onClick={onClose} variant="ghost">Cancel</Button>
          <Button type="submit" variant="primary" icon={Film} loading={busy}>{submitLabel}</Button>
        </div>
      </form>
    </Dialog>
  );
}

