import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clapperboard, LogIn, UserCheck } from 'lucide-react';
import FormShell from '../../components/FormShell.jsx';
import Field from '../../components/Field.jsx';
import Button from '../../components/Button.jsx';
import AuthDialog from '../../components/AuthDialog.jsx';
import { useRoom } from '../../hooks/useRoom.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { formatRoomCode } from '../../utils/formatters.js';
import { validateVideoInput } from '../../utils/youtube.js';
import { validateDisplayName, DISPLAY_NAME_MAX } from './validation.js';

export default function CreateRoomPage() {
  const navigate = useNavigate();
  const { createRoom } = useRoom();
  const { user, isAuthenticated } = useAuth();
  const [name, setName] = useState(user?.displayName || '');
  const [videoUrl, setVideoUrl] = useState('');
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [busy, setBusy] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);

  useEffect(() => {
    if (user?.displayName) {
      setName(user.displayName);
    }
  }, [user]);

  async function handleSubmit(event) {
    event.preventDefault();
    const effectiveName = isAuthenticated ? user?.displayName || '' : name.trim();
    const nextErrors = {
      name: isAuthenticated ? undefined : validateDisplayName(effectiveName),
      video: validateVideoInput(videoUrl),
    };
    setErrors(nextErrors);
    setSubmitError('');
    if (nextErrors.name || nextErrors.video) return;

    if (!isAuthenticated) {
      setSubmitError('Create an account or log in to host a room. Guests can join existing rooms.');
      setAuthOpen(true);
      return;
    }

    setBusy(true);
    try {
      const { roomId } = await createRoom({ displayName: effectiveName, videoUrl: videoUrl.trim() });
      navigate(`/r/${formatRoomCode(roomId)}`, { replace: true });
    } catch (error) {
      const isAuthError = error.code === 'UNAUTHORIZED' || error.code === 'ACCOUNT_REQUIRED';
      setSubmitError(error.message || 'Could not create the room.');
      if (isAuthError) {
        setAuthOpen(true);
      }
      setBusy(false);
    }
  }

  return (
    <>
      <FormShell
        title="Start a watch party"
        lead="You'll be the host. Share the link afterwards and everyone lands in the same room."
      >
        <form onSubmit={handleSubmit} noValidate className="form-stack">
          {isAuthenticated ? (
            <div
              className="form-alert"
              style={{
                background: 'rgba(144, 205, 171, 0.1)',
                borderColor: 'rgba(144, 205, 171, 0.35)',
                color: 'var(--sage)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '0.9rem',
              }}
            >
              <UserCheck size={16} aria-hidden="true" />
              <span>
                Hosting as <strong>{user?.displayName}</strong>
              </span>
            </div>
          ) : (
            <div
              className="form-alert"
              style={{
                background: 'var(--surface-sunken)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '8px',
                fontSize: '0.85rem',
              }}
            >
              <span>Hosting requires a free account to preserve your host controls.</span>
              <Button type="button" variant="secondary" size="sm" icon={LogIn} onClick={() => setAuthOpen(true)}>
                Log in / Register
              </Button>
            </div>
          )}
          <Field
            label="Your display name"
            value={isAuthenticated ? user?.displayName || '' : name}
            onChange={!isAuthenticated ? (e) => setName(e.target.value) : undefined}
            disabled={isAuthenticated}
            readOnly={isAuthenticated}
            error={!isAuthenticated ? errors.name : undefined}
            hint={
              isAuthenticated
                ? 'Your account display name is used as your host display name.'
                : undefined
            }
            maxLength={DISPLAY_NAME_MAX + 20}
            autoComplete="name"
            autoFocus={!isAuthenticated}
            placeholder="e.g. Hana Montana"
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
            autoFocus={isAuthenticated}
            placeholder="https://www.youtube.com/watch?v=…"
          />
          {submitError && (
            <div
              className="form-alert"
              role="alert"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '8px',
              }}
            >
              <span>{submitError}</span>
              {!isAuthenticated && (
                <Button type="button" variant="secondary" size="sm" onClick={() => setAuthOpen(true)}>
                  Sign in
                </Button>
              )}
            </div>
          )}
          <Button type="submit" variant="primary" size="lg" icon={Clapperboard} loading={busy}>
            {busy ? 'Opening room…' : 'Create room'}
          </Button>
        </form>
      </FormShell>
      <AuthDialog open={authOpen} onClose={() => setAuthOpen(false)} />
    </>
  );
}
