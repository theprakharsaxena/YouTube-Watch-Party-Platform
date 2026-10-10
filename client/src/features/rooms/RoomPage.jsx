import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { DoorClosed, LogIn, SearchX, UserX } from 'lucide-react';
import FormShell from '../../components/FormShell.jsx';
import Field from '../../components/Field.jsx';
import Button from '../../components/Button.jsx';
import { useRoom } from '../../hooks/useRoom.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { fetchRoomInfo } from '../../services/api.js';
import { loadSession } from '../../services/socket.js';
import { formatRoomCode, parseRoomInput } from '../../utils/formatters.js';
import { validateDisplayName } from './validation.js';
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
  const { user } = useAuth();

  const [lookup, setLookup] = useState({ status: 'checking' });
  const [name, setName] = useState(user?.username || '');
  const [nameError, setNameError] = useState('');
  const [joining, setJoining] = useState(false);
  const autoJoinTried = useRef(null);

  const isInRoom = phase === 'joined' && activeRoomId === code;

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

  async function handleSubmit(event) {
    event.preventDefault();
    const message = validateDisplayName(name);
    setNameError(message);
    if (message) return;
    setJoining(true);
    try {
      await joinRoom({ roomId: code, displayName: name.trim() });
    } catch (error) {
      setNameError(error.message);
      setJoining(false);
    }
  }

  const count = lookup.info?.participantCount ?? 0;
  return (
    <FormShell
      title="Join the watch party"
      lead={`Room ${formatRoomCode(code)} · ${count} ${count === 1 ? 'person' : 'people'} inside`}
    >
      <form onSubmit={handleSubmit} noValidate className="form-stack">
        <Field
          label="Your display name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={nameError}
          autoComplete="nickname"
          autoFocus
          placeholder="e.g. Ines"
        />
        <Button type="submit" variant="primary" size="lg" icon={LogIn} loading={joining}>
          {joining ? 'Joining…' : 'Join room'}
        </Button>
      </form>
    </FormShell>
  );
}
