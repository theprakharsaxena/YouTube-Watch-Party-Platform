import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clapperboard } from 'lucide-react';
import FormShell from '../../components/FormShell.jsx';
import Field from '../../components/Field.jsx';
import Button from '../../components/Button.jsx';
import { useRoom } from '../../hooks/useRoom.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { validateVideoInput } from '../../utils/youtube.js';
import { validateDisplayName, DISPLAY_NAME_MAX } from './validation.js';

export default function CreateRoomPage() {
  const navigate = useNavigate();
  const { createRoom } = useRoom();
  const { user } = useAuth();
  const [name, setName] = useState(user?.username || '');
  const [videoUrl, setVideoUrl] = useState('');
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = { name: validateDisplayName(name), video: validateVideoInput(videoUrl) };
    setErrors(nextErrors);
    setSubmitError('');
    if (nextErrors.name || nextErrors.video) return;

    setBusy(true);
    try {
      const { roomId } = await createRoom({ displayName: name.trim(), videoUrl: videoUrl.trim() });
      navigate(`/r/${roomId}`, { replace: true });
    } catch (error) {
      setSubmitError(error.message || 'Could not create the room.');
      setBusy(false);
    }
  }

  return (
    <FormShell
      title="Start a watch party"
      lead="You'll be the host. Share the link afterwards and everyone lands in the same room."
    >
      <form onSubmit={handleSubmit} noValidate className="form-stack">
        <Field
          label="Your display name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
          maxLength={DISPLAY_NAME_MAX + 20}
          autoComplete="nickname"
          autoFocus
          placeholder="e.g. Hana"
        />
        <Field
          label="YouTube link"
          optional
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          error={errors.video}
          hint="You can also pick a video once you're inside the room."
          inputMode="url"
          autoComplete="off"
          placeholder="https://www.youtube.com/watch?v=…"
        />
        {submitError && (
          <p className="form-alert" role="alert">
            {submitError}
          </p>
        )}
        <Button type="submit" variant="primary" size="lg" icon={Clapperboard} loading={busy}>
          {busy ? 'Opening room…' : 'Create room'}
        </Button>
      </form>
    </FormShell>
  );
}
