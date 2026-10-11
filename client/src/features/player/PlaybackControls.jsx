import { useEffect, useRef, useState } from 'react';
import { Lock, Maximize, Minimize, Pause, Play, RotateCcw, RotateCw, Volume1, Volume2, VolumeX } from 'lucide-react';
import { formatTime } from '../../utils/formatters.js';

export default function PlaybackControls({
  status,
  position,
  duration,
  canControl,
  hasVideo,
  muted = false,
  volume = 100,
  isFullscreen = false,
  onToggle,
  onSeek,
  onSkip,
  onToggleMute,
  onVolumeChange,
  onToggleFullscreen,
}) {
  const [scrub, setScrub] = useState(null);
  const scrubRef = useRef(null);
  const isDraggingRef = useRef(false);
  const pendingCommitRef = useRef(null);
  const lastCommitTimeRef = useRef(0);
  const clearTimerRef = useRef(null);

  const playing = status === 'playing';
  const max = duration > 0 ? duration : Math.max(position, 1);
  const shown = scrub ?? Math.min(position, max);

  useEffect(() => {
    if (pendingCommitRef.current !== null) {
      if (Math.abs(position - pendingCommitRef.current) < 1.0) {
        clearTimeout(clearTimerRef.current);
        pendingCommitRef.current = null;
        setScrub(null);
        scrubRef.current = null;
      }
    }
  }, [position]);

  useEffect(() => {
    return () => clearTimeout(clearTimerRef.current);
  }, []);

  const commit = (explicitVal) => {
    const now = Date.now();
    isDraggingRef.current = false;

    const target =
      typeof explicitVal === 'number' && !Number.isNaN(explicitVal)
        ? explicitVal
        : scrubRef.current;

    if (target !== null && target !== undefined && !Number.isNaN(target)) {

      if (now - lastCommitTimeRef.current < 150 && pendingCommitRef.current === target) {
        return;
      }
      lastCommitTimeRef.current = now;
      pendingCommitRef.current = target;
      scrubRef.current = target;
      setScrub(target);

      onSeek(target);

      clearTimeout(clearTimerRef.current);
      clearTimerRef.current = setTimeout(() => {
        if (pendingCommitRef.current === target) {
          pendingCommitRef.current = null;
          setScrub(null);
          scrubRef.current = null;
        }
      }, 1500);
    } else if (pendingCommitRef.current === null) {
      scrubRef.current = null;
      setScrub(null);
    }
  };

  return (
    <div className="transport">
      <div className="transport__buttons">
        {canControl ? (
          <>
            <button type="button" className="icon-btn" aria-label="Back 10 seconds" title="Back 10 seconds" disabled={!hasVideo} onClick={() => onSkip(-10)}>
              <RotateCcw size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="play-btn"
              aria-label={playing ? 'Pause for everyone' : 'Play for everyone'}
              title={playing ? 'Pause for everyone' : 'Play for everyone'}
              disabled={!hasVideo}
              onClick={onToggle}
            >
              {playing ? <Pause size={20} aria-hidden="true" /> : <Play size={20} aria-hidden="true" />}
            </button>
            <button type="button" className="icon-btn" aria-label="Forward 10 seconds" title="Forward 10 seconds" disabled={!hasVideo} onClick={() => onSkip(10)}>
              <RotateCw size={18} aria-hidden="true" />
            </button>
          </>
        ) : (
          <span className="transport__locked" title="Only the host and moderators can control playback">
            <Lock size={14} aria-hidden="true" />
            <span>Host controls playback</span>
          </span>
        )}
      </div>

      <div className="transport__timeline">
        <span className="transport__time" aria-hidden="true">{formatTime(shown)}</span>
        {canControl ? (
          <input
            type="range"
            className="scrubber"
            aria-label="Seek"
            aria-valuetext={`${formatTime(shown)} of ${formatTime(max)}`}
            min={0}
            max={max}
            step={0.5}
            value={shown}
            disabled={!hasVideo || duration <= 0}
            style={{ '--progress': `${(shown / max) * 100}%` }}
            onPointerDown={(e) => {
              isDraggingRef.current = true;
              const val = Number(e.target.value);
              scrubRef.current = val;
              setScrub(val);
            }}
            onChange={(e) => {
              const val = Number(e.target.value);
              scrubRef.current = val;
              setScrub(val);

              if (!isDraggingRef.current) {
                commit(val);
              }
            }}
            onPointerUp={(e) => {
              const val = Number(e.target.value);
              commit(!Number.isNaN(val) ? val : undefined);
            }}
            onPointerCancel={() => {
              commit();
            }}
            onKeyUp={(e) => {
              const val = Number(e.target.value);
              commit(!Number.isNaN(val) ? val : undefined);
            }}
          />
        ) : (
          <div
            className="scrubber scrubber--readonly"
            role="progressbar"
            aria-label="Playback position"
            aria-valuemin={0}
            aria-valuemax={Math.round(max)}
            aria-valuenow={Math.round(shown)}
            aria-valuetext={`${formatTime(shown)} of ${formatTime(max)}`}
            style={{ '--progress': `${(shown / max) * 100}%` }}
          />
        )}
        <span className="transport__time" aria-hidden="true">{formatTime(duration)}</span>
      </div>

      <div className="volume-control">
        <button
          type="button"
          className="icon-btn"
          aria-label={muted || volume === 0 ? 'Unmute on this device' : 'Mute on this device'}
          title={muted || volume === 0 ? 'Unmute on this device (m)' : 'Mute on this device (m)'}
          aria-pressed={muted || volume === 0}
          disabled={!hasVideo}
          onClick={onToggleMute}
        >
          {muted || volume === 0 ? (
            <VolumeX size={18} aria-hidden="true" />
          ) : volume < 50 ? (
            <Volume1 size={18} aria-hidden="true" />
          ) : (
            <Volume2 size={18} aria-hidden="true" />
          )}
        </button>
        <input
          type="range"
          className="volume-slider"
          aria-label="Volume level"
          min={0}
          max={100}
          step={1}
          value={muted ? 0 : volume}
          disabled={!hasVideo}
          style={{ '--volume-level': `${muted ? 0 : volume}%` }}
          onChange={(e) => onVolumeChange?.(Number(e.target.value))}
        />
      </div>

      {onToggleFullscreen && (
        <button
          type="button"
          className="icon-btn"
          aria-label={isFullscreen ? 'Exit full screen' : 'Full screen'}
          title={isFullscreen ? 'Exit full screen (f)' : 'Full screen (f)'}
          aria-pressed={isFullscreen}
          disabled={!hasVideo}
          onClick={onToggleFullscreen}
        >
          {isFullscreen ? <Minimize size={18} aria-hidden="true" /> : <Maximize size={18} aria-hidden="true" />}
        </button>
      )}
    </div>
  );
}

