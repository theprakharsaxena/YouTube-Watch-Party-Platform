import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Crown, Eye, Film, RefreshCw, ShieldCheck, WifiOff } from 'lucide-react';
import { useRoom } from '../../hooks/useRoom.jsx';
import { useYouTubePlayer } from '../../hooks/useYouTubePlayer.js';
import { useToast } from '../../components/Toast.jsx';
import Dialog from '../../components/Dialog.jsx';
import Button from '../../components/Button.jsx';
import RoleBadge from '../../components/RoleBadge.jsx';
import PlayerStage from '../player/PlayerStage.jsx';
import PlaybackControls from '../player/PlaybackControls.jsx';
import ChangeVideoDialog from '../player/ChangeVideoDialog.jsx';
import { usePlaybackSync } from '../player/usePlaybackSync.js';
import { PlayerState } from '../player/youtubePlayer.js';
import ParticipantRail from '../participants/ParticipantRail.jsx';
import RoomTopBar from './RoomTopBar.jsx';
import { copyText, inviteUrl } from '../../utils/clipboard.js';
import { expectedPosition } from '../../utils/sync.js';

const ROLE_NOTES = {
  host: { icon: Crown, text: 'You are the host. You control playback, roles and who is in the room.' },
  moderator: { icon: ShieldCheck, text: 'You are a moderator. You can play, pause, seek and change the video.' },
  participant: { icon: Eye, text: 'You are watching along. The host and moderators control playback for everyone.' },
};

/** Re-render a few times per second so the clock tracks the extrapolated room position. */
function useNow(intervalMs) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export default function WatchRoom() {
  const navigate = useNavigate();
  const toast = useToast();
  const room = useRoom();
  const { state, receivedAt, canControl, role, host, meParticipant, connection } = room;
  const { playback } = state;

  const player = useYouTubePlayer(playback.videoId);
  const { controller, ready, playerState, duration, title } = player;
  const sync = usePlaybackSync({ controller, ready, playback, receivedAt, playerState });

  const [railOpen, setRailOpen] = useState(false);
  const [videoDialogOpen, setVideoDialogOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [muted, setMuted] = useState(false);

  const now = useNow(250);
  const hasVideo = Boolean(playback.videoId);
  const playing = playback.status === 'playing';
  const rawPosition = expectedPosition(playback, receivedAt, now);
  const position = duration > 0 ? Math.min(rawPosition, duration) : rawPosition;

  // A controller's player reaching the end pauses the room there (never from remote-applied events).
  useEffect(() => {
    if (playerState === PlayerState.ENDED && canControl && playing && !sync.isApplyingRemote()) {
      room.sendPlayback('pause', duration || undefined);
    }
  }, [playerState]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleInvite = useCallback(async () => {
    const ok = await copyText(inviteUrl(state.roomId));
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Invite link copied.');
    } else {
      toast.error('Could not copy. Copy the link from the address bar instead.');
    }
  }, [state.roomId, toast]);

  const togglePlay = () => {
    if (playing) room.sendPlayback('pause', controller?.getCurrentTime() || undefined);
    else room.sendPlayback('play');
  };
  const seekTo = (seconds) => {
    const upper = duration > 0 ? duration : seconds;
    room.sendPlayback('seek', Math.max(0, Math.min(seconds, upper)));
  };
  const toggleMute = () => {
    if (!controller) return;
    if (muted) controller.unMute();
    else controller.mute();
    setMuted(!muted);
  };

  const closeRail = useCallback(() => setRailOpen(false), []);
  const RoleIcon = ROLE_NOTES[role]?.icon ?? Eye;

  function leave() {
    room.leaveRoom();
    navigate('/');
  }

  return (
    <div className="room">
      <RoomTopBar
        roomId={state.roomId}
        connection={connection}
        participantCount={room.participants.length}
        copied={copied}
        onInvite={handleInvite}
        onLeave={() => setLeaveOpen(true)}
        onToggleRail={() => setRailOpen((v) => !v)}
        railOpen={railOpen}
      />

      {connection !== 'connected' && (
        <div className="banner banner--warn" role="status">
          <WifiOff size={16} aria-hidden="true" />
          <span>Connection lost. Reconnecting… Your seat is held for a short time.</span>
        </div>
      )}
      {!state.hostConnected && connection === 'connected' && (
        <div className="banner" role="status">
          <RefreshCw size={16} aria-hidden="true" />
          <span>The host is offline. Moderators can still control playback.</span>
        </div>
      )}

      <div className="room__body">
        <main className="room__stage" aria-label="Watch room">
          <PlayerStage
            hostRef={player.hostRef}
            hasVideo={hasVideo}
            ready={ready}
            loadFailed={player.loadFailed}
            playerError={player.playerError}
            autoplayBlocked={sync.autoplayBlocked}
            canControl={canControl}
            onResume={sync.resumeFromGesture}
            onChooseVideo={() => setVideoDialogOpen(true)}
            onShieldClick={togglePlay}
          />

          <div className="status-row">
            <span className={`status-pill status-pill--${playing ? 'playing' : 'paused'}`}>
              <span className="status-pill__dot" aria-hidden="true" />
              {!hasVideo ? 'No video' : playing ? 'Playing for everyone' : 'Paused for everyone'}
            </span>
            {hasVideo && playing && sync.syncStatus !== 'idle' && (
              <span className={`sync-note sync-note--${sync.syncStatus}`} role="status">
                {sync.syncStatus === 'synced' ? 'In step with the room' : 'Catching up to the room…'}
              </span>
            )}
            <span className="status-row__spacer" />
            <RoleBadge role={role} />
          </div>

          <PlaybackControls
            status={playback.status}
            position={position}
            duration={duration}
            canControl={canControl}
            hasVideo={hasVideo}
            muted={muted}
            onToggle={togglePlay}
            onSeek={seekTo}
            onSkip={(delta) => seekTo(position + delta)}
            onToggleMute={toggleMute}
          />

          <div className="now-playing">
            <div className="now-playing__text">
              <p className="now-playing__eyebrow">Now showing</p>
              <h1 className="now-playing__title">{hasVideo ? title || 'YouTube video' : 'Nothing queued yet'}</h1>
              <p className="now-playing__meta">
                Host: <strong>{host?.name ?? '—'}</strong>
                {meParticipant && host?.id !== meParticipant.id ? '' : ' (you)'}
              </p>
            </div>
            {canControl && (
              <Button variant="secondary" icon={Film} onClick={() => setVideoDialogOpen(true)} id="change-video-button">
                {hasVideo ? 'Change video' : 'Choose video'}
              </Button>
            )}
          </div>

          <p className="permission-note">
            <RoleIcon size={16} aria-hidden="true" />
            <span>{ROLE_NOTES[role]?.text}</span>
          </p>
        </main>

        <ParticipantRail
          participants={room.participants}
          meId={room.me.participantId}
          isHost={room.isHost}
          hostConnected={state.hostConnected}
          open={railOpen}
          onClose={closeRail}
          onInvite={handleInvite}
          onAssignRole={room.assignRole}
          onRemove={room.removeParticipant}
        />
      </div>

      <ChangeVideoDialog open={videoDialogOpen} onClose={() => setVideoDialogOpen(false)} onSubmit={room.changeVideo} />

      <Dialog
        open={leaveOpen}
        onClose={() => setLeaveOpen(false)}
        title="Leave this room?"
        description={room.isHost ? 'You are the host. Leaving hands the room to a moderator or the longest-standing participant.' : 'You can rejoin later with the invite link.'}
        labelledBy="leave-title"
      >
        <div className="dialog__actions">
          <Button variant="ghost" onClick={() => setLeaveOpen(false)}>Stay</Button>
          <Button variant="danger" onClick={leave}>Leave room</Button>
        </div>
      </Dialog>
    </div>
  );
}
