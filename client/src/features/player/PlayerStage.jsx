import { useCallback, useEffect, useRef } from 'react';
import { AlertTriangle, Film, Hourglass, Play, RefreshCw } from 'lucide-react';
import Button from '../../components/Button.jsx';
import useAmbientLighting from './useAmbientLighting.js';
import useAmbientSyncPlayer from './useAmbientSyncPlayer.js';

const DOUBLE_CLICK_MAX_GAP_MS = 600;

const SINGLE_CLICK_WAIT_MS = 320;

export default function PlayerStage({
  hostRef,
  hasVideo,
  videoId = null,
  playing = false,
  position = 0,
  duration = 0,
  ambientMode = true,
  ready,
  loadFailed,
  playerError,
  autoplayBlocked,
  canControl,
  isFullscreen,
  onResume,
  onChooseVideo,
  onShieldClick,
  onDoubleClick,
}) {
  const clickTimerRef = useRef(null);
  const lastClickTimeRef = useRef(0);
  const singleClickExecutedRef = useRef(false);

  useEffect(() => {
    return () => {
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
      }
    };
  }, []);

  const handleStageClick = useCallback((e) => {

    if (e.target.closest('button, a, input, select, textarea, [role="button"]')) {
      return;
    }
    e.stopPropagation();

    const now = Date.now();
    const timeSinceLast = now - lastClickTimeRef.current;

    if (lastClickTimeRef.current > 0 && timeSinceLast <= DOUBLE_CLICK_MAX_GAP_MS) {

      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
        clickTimerRef.current = null;
      }

      if (singleClickExecutedRef.current) {
        singleClickExecutedRef.current = false;
        if (canControl && onShieldClick) {
          onShieldClick();
        }
      }

      lastClickTimeRef.current = 0;

      onDoubleClick?.();
    } else {

      lastClickTimeRef.current = now;
      singleClickExecutedRef.current = false;

      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
        clickTimerRef.current = null;
      }

      if (canControl && onShieldClick) {
        clickTimerRef.current = setTimeout(() => {
          singleClickExecutedRef.current = true;
          clickTimerRef.current = null;
          onShieldClick();
        }, SINGLE_CLICK_WAIT_MS);
      }
    }
  }, [canControl, onShieldClick, onDoubleClick]);

  const isAmbientActive = Boolean(hasVideo && ambientMode && !isFullscreen);

  const { imageUrl, style: ambientStyle } = useAmbientLighting({
    videoId,
    position,
    duration,
    enabled: isAmbientActive,
  });

  const ambientPlayerHostRef = useAmbientSyncPlayer({
    videoId,
    playing,
    position,
    enabled: isAmbientActive,
  });

  return (
    <div className={`stage${isFullscreen ? ' stage--fullscreen' : ''}`}>
      {isAmbientActive && (
        <div
          className={`stage__ambient${playing ? ' stage__ambient--playing' : ''}`}
          style={ambientStyle}
          data-testid="stage-ambient"
          aria-hidden="true"
        >
          {imageUrl && (
            <div
              className="stage__ambient-art"
              data-testid="stage-ambient-art"
              style={{
                backgroundImage: `url(${imageUrl})`,
              }}
            />
          )}
          <div className="stage__ambient-mesh" />
          <div
            ref={ambientPlayerHostRef}
            className="stage__ambient-video"
            data-testid="stage-ambient-video"
          />
        </div>
      )}

      <div
        className="stage__frame"
        onClick={handleStageClick}
        onDoubleClick={(e) => e.preventDefault()}
      >
        <div ref={hostRef} className="stage__player" />

        {hasVideo && !loadFailed && !ready && (
          <div className="stage__overlay stage__overlay--plain" role="status">
            <span className="stage__spinner" aria-hidden="true" />
            <p>Loading the player…</p>
          </div>
        )}

        {hasVideo && ready && !playerError && (
          <div
            className={`stage__shield${canControl ? ' stage__shield--active' : ''}`}
            onClick={handleStageClick}
            onDoubleClick={(e) => e.preventDefault()}
            title={canControl ? 'Click to play/pause · Double-click for full screen' : 'Double-click for full screen'}
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

