import { useCallback, useEffect, useRef } from 'react';
import { AlertTriangle, Film, Hourglass, Play, RefreshCw } from 'lucide-react';
import Button from '../../components/Button.jsx';

// Generous gap threshold (ms) to recognize double clicks even when clicks are not frequent or have a gap.
const DOUBLE_CLICK_MAX_GAP_MS = 600;
// Wait duration (ms) for a single click before executing play/pause, allowing relaxed 2nd clicks to cancel it.
const SINGLE_CLICK_WAIT_MS = 320;

/** The cinematic stage. The YouTube iframe lives in `hostRef`; everything else is overlay. */
export default function PlayerStage({
  hostRef,
  hasVideo,
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

  // Clean up any pending click timer on unmount
  useEffect(() => {
    return () => {
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
      }
    };
  }, []);

  const handleStageClick = useCallback((e) => {
    // If the click is on an interactive button or link inside an overlay, ignore
    if (e.target.closest('button, a, input, select, textarea, [role="button"]')) {
      return;
    }
    e.stopPropagation();

    const now = Date.now();
    const timeSinceLast = now - lastClickTimeRef.current;

    // Detect double click even with a relaxed time gap (up to 600ms)
    if (lastClickTimeRef.current > 0 && timeSinceLast <= DOUBLE_CLICK_MAX_GAP_MS) {
      // 1. Cancel pending single-click timer
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
        clickTimerRef.current = null;
      }

      // 2. If single-click already executed because the gap was between 320ms and 600ms,
      // revert the accidental toggle so the video state remains undisturbed
      if (singleClickExecutedRef.current) {
        singleClickExecutedRef.current = false;
        if (canControl && onShieldClick) {
          onShieldClick();
        }
      }

      // 3. Reset click counter so subsequent clicks don't re-toggle
      lastClickTimeRef.current = 0;

      // 4. Trigger fullscreen!
      onDoubleClick?.();
    } else {
      // First click of a potential sequence
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

  return (
    <div className={`stage${isFullscreen ? ' stage--fullscreen' : ''}`}>
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

        {/* Transparent shield: YouTube's own click-to-pause must not bypass role checks. */}
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
