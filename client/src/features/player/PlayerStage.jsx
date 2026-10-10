import { AlertTriangle, Film, Hourglass, Play, RefreshCw } from 'lucide-react';
import Button from '../../components/Button.jsx';

/** The cinematic stage. The YouTube iframe lives in `hostRef`; everything else is overlay. */
export default function PlayerStage({
  hostRef,
  hasVideo,
  ready,
  loadFailed,
  playerError,
  autoplayBlocked,
  canControl,
  onResume,
  onChooseVideo,
  onShieldClick,
}) {
  return (
    <div className="stage">
      <div className="stage__frame">
        <div ref={hostRef} className="stage__player" />

        {hasVideo && !loadFailed && !ready && (
          <div className="stage__overlay stage__overlay--plain" role="status">
            <span className="stage__spinner" aria-hidden="true" />
            <p>Loading the player…</p>
          </div>
        )}

        {/* Transparent shield: YouTube's own click-to-pause must not bypass role checks. */}
        {hasVideo && ready && !playerError && (
          <div
            className={`stage__shield${canControl ? ' stage__shield--active' : ''}`}
            onClick={canControl ? onShieldClick : undefined}
            aria-hidden="true"
          />
        )}

        {!hasVideo && (
          <div className="stage__overlay">
            <Film size={34} strokeWidth={1.4} aria-hidden="true" />
            <h2>{canControl ? 'Nothing on the screen yet' : 'Waiting for a video'}</h2>
            <p>
              {canControl
                ? 'Paste a YouTube link to put something on for the room.'
                : 'The host or a moderator will choose what to watch. It will appear here for everyone.'}
            </p>
            {canControl ? (
              <Button variant="primary" icon={Film} onClick={onChooseVideo}>Choose a video</Button>
            ) : (
              <span className="stage__waiting"><Hourglass size={14} aria-hidden="true" /> Listening for the host</span>
            )}
          </div>
        )}

        {loadFailed && (
          <div className="stage__overlay" role="alert">
            <AlertTriangle size={30} strokeWidth={1.5} aria-hidden="true" />
            <h2>The YouTube player did not load</h2>
            <p>This is usually a blocked script or a dropped connection. Check your network or ad blocker, then try again.</p>
            <Button variant="primary" icon={RefreshCw} onClick={() => window.location.reload()}>Reload page</Button>
          </div>
        )}

        {playerError && (
          <div className="stage__overlay" role="alert">
            <AlertTriangle size={30} strokeWidth={1.5} aria-hidden="true" />
            <h2>This video can't play here</h2>
            <p>{playerError.message}</p>
            {canControl ? (
              <Button variant="primary" icon={Film} onClick={onChooseVideo}>Choose another video</Button>
            ) : (
              <p className="stage__muted">Ask the host or a moderator to pick a different one.</p>
            )}
          </div>
        )}

        {autoplayBlocked && !playerError && (
          <button type="button" className="stage__overlay stage__overlay--gesture" onClick={onResume}>
            <span className="stage__gesture-icon"><Play size={26} aria-hidden="true" /></span>
            <strong>Click to join playback</strong>
            <span>Your browser blocked automatic playback. One click starts the video in step with the room.</span>
          </button>
        )}
      </div>
    </div>
  );
}
