import { useCallback, useEffect, useRef, useState } from 'react';
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
import ReactionOverlay from '../reactions/ReactionOverlay.jsx';
import ReactionPicker from '../reactions/ReactionPicker.jsx';
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
  const [suggestDialogOpen, setSuggestDialogOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [muted, setMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showFsHud, setShowFsHud] = useState(true);
  const fullscreenContainerRef = useRef(null);
  const hudTimerRef = useRef(null);

  const now = useNow(250);
  const hasVideo = Boolean(playback.videoId);
  const playing = playback.status === 'playing';
  const rawPosition = expectedPosition(playback, receivedAt, now);
  const position = duration > 0 ? Math.min(rawPosition, duration) : rawPosition;

  useEffect(() => {
    const onFsChange = () => {
      const active = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
      setIsFullscreen(active);
      if (active) setShowFsHud(true);
    };
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange', onFsChange);
    };
  }, []);

  const fsPendingRef = useRef(false);

  const toggleFullscreen = useCallback(async () => {
    const el = fullscreenContainerRef.current;
    if (!el || fsPendingRef.current) return;
    fsPendingRef.current = true;
    try {
      const active = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
      if (!active) {
        if (el.requestFullscreen) await el.requestFullscreen();
        else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
      } else {
        if (document.exitFullscreen) await document.exitFullscreen();
        else if (document.webkitExitFullscreen) await document.webkitExitFullscreen();
      }
    } catch {
      /* ignore */
    } finally {
      setTimeout(() => {
        fsPendingRef.current = false;
      }, 250);
    }
  }, []);

  const handleMouseMove = useCallback(() => {
    if (!isFullscreen) return;
    setShowFsHud(true);
    clearTimeout(hudTimerRef.current);
    hudTimerRef.current = setTimeout(() => setShowFsHud(false), 2500);
  }, [isFullscreen]);

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
    const curTime = controller?.getCurrentTime();
    const accurateTime =
      typeof curTime === 'number' && curTime >= 0
        ? Math.round(curTime * 100) / 100
        : Math.round(position * 100) / 100;

    if (playing) {
      room.sendPlayback('pause', accurateTime);
      controller?.pause();
      sync.notifySeek?.(accurateTime);
    } else {
      const resumeTime =
        playback.status === 'paused' && typeof playback.position === 'number' && playback.position >= 0
          ? Math.round(playback.position * 100) / 100
          : accurateTime;
      room.sendPlayback('play', resumeTime);
      controller?.seekTo(resumeTime);
      controller?.play();
      sync.notifySeek?.(resumeTime);
    }
  };
  const seekTo = (seconds) => {
    const upper = duration > 0 ? duration : seconds;
    const clamped = Math.round(Math.max(0, Math.min(seconds, upper)) * 100) / 100;
    sync.notifySeek?.(clamped);
    room.sendPlayback('seek', clamped);
    controller?.seekTo(clamped);
  };
  const toggleMute = () => {
    if (!controller) return;
    if (muted) controller.unMute();
    else controller.mute();
    setMuted(!muted);
  };

  const closeRail = useCallback(() => setRailOpen(false), []);
  const RoleIcon = ROLE_NOTES[role]?.icon ?? Eye;

  // Keyboard shortcuts: F for fullscreen, Space for play/pause, M for mute
  useEffect(() => {
    const onKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName) || videoDialogOpen || leaveOpen) return;
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        toggleMute();
      } else if (e.key === ' ' && canControl && hasVideo) {
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toggleFullscreen, canControl, hasVideo, videoDialogOpen, leaveOpen, playing]); // eslint-disable-line react-hooks/exhaustive-deps

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

      {canControl && room.pendingRequests?.length > 0 && (
        <div className="pending-requests" role="region" aria-label="Pending video requests">
          {room.pendingRequests.map((req) => (
            <div key={req.id} className="banner banner--approval">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Film size={16} aria-hidden="true" />
                <span>
                  <strong>{req.requesterName}</strong> requested to change video
                  {req.payload?.videoUrl ? `: ${req.payload.videoUrl}` : ''}
                </span>
              </div>
              <div className="banner__actions">
                <Button size="sm" variant="primary" onClick={() => room.respondChangeRequest(req.id, true)}>
                  Approve
                </Button>
                <Button size="sm" variant="ghost" onClick={() => room.respondChangeRequest(req.id, false)}>
                  Decline
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!canControl && room.pendingRequests?.some((r) => r.requesterId === meParticipant?.id) && (
        <div className="banner" role="status">
          <RefreshCw size={16} aria-hidden="true" />
          <span>Your video change request has been submitted and is awaiting approval by the host or moderator.</span>
        </div>
      )}

      <div className="room__body">
        <main className="room__stage" aria-label="Watch room">
          <div
            ref={fullscreenContainerRef}
            className={`stage-wrapper${isFullscreen ? ' stage-wrapper--fullscreen' : ''}`}
            onMouseMove={handleMouseMove}
          >
            <PlayerStage
              hostRef={player.hostRef}
              hasVideo={hasVideo}
              ready={ready}
              loadFailed={player.loadFailed}
              playerError={player.playerError}
              autoplayBlocked={sync.autoplayBlocked}
              canControl={canControl}
              isFullscreen={isFullscreen}
              onResume={sync.resumeFromGesture}
              onChooseVideo={() => setVideoDialogOpen(true)}
              onShieldClick={togglePlay}
              onDoubleClick={toggleFullscreen}
            />

            <ReactionOverlay reactions={room.reactions} />

            {isFullscreen && (
              <div className={`stage__fs-hud${showFsHud ? '' : ' stage__fs-hud--hidden'}`}>
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
                  isFullscreen={isFullscreen}
                  onToggle={togglePlay}
                  onSeek={seekTo}
                  onSkip={(delta) => seekTo(position + delta)}
                  onToggleMute={toggleMute}
                  onToggleFullscreen={toggleFullscreen}
                />
              </div>
            )}
          </div>

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
            <ReactionPicker onSendReaction={room.sendReaction} />
            <RoleBadge role={role} />
          </div>

          <PlaybackControls
            status={playback.status}
            position={position}
            duration={duration}
            canControl={canControl}
            hasVideo={hasVideo}
            muted={muted}
            isFullscreen={isFullscreen}
            onToggle={togglePlay}
            onSeek={seekTo}
            onSkip={(delta) => seekTo(position + delta)}
            onToggleMute={toggleMute}
            onToggleFullscreen={toggleFullscreen}
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
            {canControl ? (
              <Button variant="secondary" icon={Film} onClick={() => setVideoDialogOpen(true)} id="change-video-button">
                {hasVideo ? 'Change video' : 'Choose video'}
              </Button>
            ) : (
              <Button variant="secondary" icon={Film} onClick={() => setSuggestDialogOpen(true)} id="suggest-video-button">
                Suggest video
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
          messages={room.chatMessages}
          onSendMessage={room.sendChatMessage}
          onClose={closeRail}
          onInvite={handleInvite}
          onAssignRole={room.assignRole}
          onRemove={room.removeParticipant}
        />
      </div>

      <ChangeVideoDialog open={videoDialogOpen} onClose={() => setVideoDialogOpen(false)} onSubmit={room.changeVideo} />

      <ChangeVideoDialog
        open={suggestDialogOpen}
        onClose={() => setSuggestDialogOpen(false)}
        onSubmit={async (url) => {
          room.requestChange('change_video', { videoUrl: url });
        }}
        title="Suggest a video"
        description="The host or moderator will review and approve your suggestion before it plays for the room."
        submitLabel="Request approval"
      />

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
