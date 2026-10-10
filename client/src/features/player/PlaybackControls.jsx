import { useEffect, useState } from 'react';
import { Lock, Pause, Play, RotateCcw, RotateCw, Volume2, VolumeX } from 'lucide-react';
import { formatTime } from '../../utils/formatters.js';

/**
 * Transport bar.
 * Controllers get a working scrubber and buttons; participants get a read-only progress
 * track and an explanation. (Real enforcement happens on the server.)
 */
export default function PlaybackControls({
  status,
  position,
  duration,
  canControl,
  hasVideo,
  muted,
  onToggle,
  onSeek,
  onSkip,
  onToggleMute,
}) {
  const [scrub, setScrub] = useState(null); // local value while dragging; committed on release
  const playing = status === 'playing';
  const max = duration > 0 ? duration : Math.max(position, 1);
  const shown = scrub ?? Math.min(position, max);

  useEffect(() => {
    setScrub(null);
  }, [status]);

  const commit = () => {
    if (scrub !== null) onSeek(scrub);
    setScrub(null);
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
            step={1}
            value={shown}
            disabled={!hasVideo || duration <= 0}
            style={{ '--progress': `${(shown / max) * 100}%` }}
            onChange={(e) => setScrub(Number(e.target.value))}
            onPointerUp={commit}
            onKeyUp={commit}
            onBlur={commit}
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

      <button
        type="button"
        className="icon-btn"
        aria-label={muted ? 'Unmute on this device' : 'Mute on this device'}
        title={muted ? 'Unmute on this device' : 'Mute on this device'}
        aria-pressed={muted}
        disabled={!hasVideo}
        onClick={onToggleMute}
      >
        {muted ? <VolumeX size={18} aria-hidden="true" /> : <Volume2 size={18} aria-hidden="true" />}
      </button>
    </div>
  );
}
