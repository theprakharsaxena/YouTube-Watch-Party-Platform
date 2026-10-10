import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { DoorClosed, Eye, LogIn, SearchX, UserCheck, UserX } from 'lucide-react';
import FormShell from '../../components/FormShell.jsx';
import Field from '../../components/Field.jsx';
import Button from '../../components/Button.jsx';
import AuthDialog from '../../components/AuthDialog.jsx';
import { useRoom } from '../../hooks/useRoom.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { fetchRoomInfo } from '../../services/api.js';
import { loadSession } from '../../services/socket.js';
import { formatRoomCode, parseRoomInput } from '../../utils/formatters.js';
import { validateDisplayName, DISPLAY_NAME_MAX } from './validation.js';
import WatchRoom from './WatchRoom.jsx';

function StatusCard({ icon: Icon, title, children, action }) {
  return (
    <FormShell title={title}>
      <div className="status-card">
        <Icon size={28} aria-hidden="true" className="status-card__icon" />
        <p>{children}</p>
        {action}
      </div>
    </FormShell>
  );
}

function Loading({ label }) {
  return (
    <FormShell title={label} footer={<span />}>
      <div className="loading-lines" role="status" aria-label={label}>
        <span /><span /><span />
      </div>
    </FormShell>
  );
}

const ENDED_COPY = {
  removed: { icon: UserX, title: 'You were removed', text: 'The host removed you from this room. You can start a room of your own any time.' },
  replaced: { icon: DoorClosed, title: 'Opened somewhere else', text: 'This seat was taken over by another tab, so this one disconnected.' },
  closed: { icon: DoorClosed, title: 'This room has ended', text: 'The room no longer exists. Rooms are removed when everyone leaves or the server restarts.' },
};

/**
 * Route gate for /r/:roomId.
 * joined -> watch room | ended -> explanation | has saved seat -> silent rejoin | otherwise name prompt.
 */
export default function RoomPage() {
  const { roomId: rawId } = useParams();
  const code = parseRoomInput(rawId);
  const room = useRoom();
  const { phase, roomId: activeRoomId, endedReason, joinRoom, resetRoom } = room;
  const { user, token, isAuthenticated, guestLogin } = useAuth();

  const [lookup, setLookup] = useState({ status: 'checking' });
  const [name, setName] = useState(user?.username || '');
  const [nameError, setNameError] = useState('');
  const [joining, setJoining] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const autoJoinTried = useRef(null);

  const isInRoom = phase === 'joined' && activeRoomId === code;

  useEffect(() => {
    if (user?.username) {
      setName(user.username);
    }
  }, [user]);

  useEffect(() => {
    if (!code || isInRoom || phase === 'ended') return undefined;
    const controller = new AbortController();
    setLookup({ status: 'checking' });
    fetchRoomInfo(code, { signal: controller.signal })
      .then((info) => setLookup({ status: 'ok', info }))
      .catch((error) => {
        if (error.name === 'AbortError') return;
        setLookup({ status: error.code === 'ROOM_NOT_FOUND' ? 'missing' : 'error', message: error.message });
      });
    return () => controller.abort();
  }, [code, isInRoom, phase]);

  // Returning visitor (refresh / reconnect): reclaim the saved seat without asking again.
  useEffect(() => {
    if (lookup.status !== 'ok' || isInRoom || phase !== 'idle') return;
    if (!loadSession(code)?.token || autoJoinTried.current === code) return;
    autoJoinTried.current = code;
    joinRoom({ roomId: code }).catch((error) => setLookup({ status: 'error', message: error.message }));
  }, [lookup.status, isInRoom, phase, code, joinRoom]);

  if (!code) {
    return (
      <StatusCard icon={SearchX} title="Invalid room link" action={<Link className="btn btn--primary btn--md" to="/join">Enter a room code</Link>}>
        That link does not contain a valid room code.
      </StatusCard>
    );
  }

  if (isInRoom) return <WatchRoom />;

  if (phase === 'ended') {
    const copy = ENDED_COPY[endedReason] ?? ENDED_COPY.closed;
    return (
      <StatusCard
        icon={copy.icon}
        title={copy.title}
        action={<Link className="btn btn--primary btn--md" to="/" onClick={resetRoom}>Back to start</Link>}
      >
        {copy.text}
      </StatusCard>
    );
  }

  if (lookup.status === 'checking') return <Loading label="Looking for the room…" />;

  if (lookup.status === 'missing') {
    return (
      <StatusCard icon={SearchX} title="Room not found" action={<Link className="btn btn--primary btn--md" to="/create">Start a new room</Link>}>
        This room does not exist or has ended. Ask the host for a fresh link.
      </StatusCard>
    );
  }

  if (lookup.status === 'error') {
    return (
      <StatusCard icon={SearchX} title="Could not join" action={<Button variant="primary" onClick={() => window.location.reload()}>Try again</Button>}>
        {lookup.message}
      </StatusCard>
    );
  }

  if (phase === 'joining' || loadSession(code)?.token) return <Loading label="Joining the room…" />;

  async function handleJoinAsParticipant(event) {
    if (event) event.preventDefault();
    setNameError('');
    if (!isAuthenticated) {
      setAuthOpen(true);
      return;
    }
    setJoining(true);
    try {
      await joinRoom({ roomId: code, displayName: user.username });
    } catch (error) {
      setNameError(error.message);
      setJoining(false);
    }
  }

  async function handleJoinAsViewer(event) {
    if (event) event.preventDefault();
    const clean = (name || '').trim();
    const message = validateDisplayName(clean || 'Viewer');
    setNameError(message);
    if (message) return;
    setJoining(true);
    try {
      if (!token || !user?.isGuest) {
        await guestLogin(clean || 'Viewer');
      }
      await joinRoom({ roomId: code, displayName: clean || 'Viewer' });
    } catch (error) {
      setNameError(error.message);
      setJoining(false);
    }
  }

  const count = lookup.info?.participantCount ?? 0;

  return (
    <>
      <FormShell
        title="Join the watch party"
        lead={`Room ${formatRoomCode(code)} · ${count} ${count === 1 ? 'person' : 'people'} inside`}
      >
        {isAuthenticated ? (
          <form onSubmit={handleJoinAsParticipant} noValidate className="form-stack">
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
                Logged in as <strong>{user?.username}</strong> (Participant)
              </span>
            </div>
            {nameError && (
              <p className="form-alert" role="alert">
                {nameError}
              </p>
            )}
            <Button type="submit" variant="primary" size="lg" icon={LogIn} loading={joining}>
              {joining ? 'Joining…' : 'Join room as Participant'}
            </Button>
          </form>
        ) : (
          <div className="form-stack">
            {/* Option 1: Login before joining as participant */}
            <div
              style={{
                padding: '16px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-subtle)',
                display: 'grid',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                <UserCheck size={16} style={{ color: 'var(--sage)' }} aria-hidden="true" />
                <span>Join as Participant</span>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
                Log in to chat, react, and request video changes. All participants must be logged in.
              </p>
              <Button
                type="button"
                variant="primary"
                size="md"
                icon={LogIn}
                onClick={() => setAuthOpen(true)}
              >
                Log in / Register to Join
              </Button>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                color: 'var(--text-muted)',
                fontSize: '0.8rem',
                margin: '2px 0',
              }}
            >
              <span style={{ flex: 1, height: '1px', background: 'var(--line)' }} />
              <span>OR JOIN AS VIEWER</span>
              <span style={{ flex: 1, height: '1px', background: 'var(--line)' }} />
            </div>

            {/* Option 2: Viewer join without login */}
            <form onSubmit={handleJoinAsViewer} noValidate className="form-stack">
              <div style={{ display: 'grid', gap: '6px' }}>
                <Field
                  label="Viewer display name (optional)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  error={nameError}
                  maxLength={DISPLAY_NAME_MAX}
                  autoComplete="off"
                  placeholder="Viewer"
                  hint="Viewers simply join without logging in to watch in sync."
                />
              </div>
              <Button type="submit" variant="secondary" size="lg" icon={Eye} loading={joining}>
                {joining ? 'Joining…' : 'Join as Viewer (without login)'}
              </Button>
            </form>
          </div>
        )}
      </FormShell>
      <AuthDialog open={authOpen} onClose={() => setAuthOpen(false)} />
    </>
  );
}
