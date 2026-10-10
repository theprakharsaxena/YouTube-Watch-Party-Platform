import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, Lock, Sparkles, Volume2, VolumeX, Radio, Check, Zap } from 'lucide-react';
import Avatar from '../../components/Avatar.jsx';
import RoleBadge from '../../components/RoleBadge.jsx';

const SAMPLE_PARTICIPANTS = [
  { name: 'Hana', role: 'host', status: 'Broadcasting remote', ping: '12ms' },
  { name: 'Ines', role: 'moderator', status: 'Queue approved', ping: '18ms' },
  { name: 'Theo', role: 'participant', status: 'Buffered 100%', ping: '24ms' },
];

const REACTIONS = ['🍿', '🔥', '❤️', '🚀', '👏', '✨'];

export default function InteractiveRoomPreview() {
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(102); // 01:42 in seconds
  const totalDuration = 258; // 04:18 in seconds
  const [isMuted, setIsMuted] = useState(true);
  const [syncStatus, setSyncStatus] = useState('synced'); // 'synced' | 'syncing' | 'drift'
  const [syncMessage, setSyncMessage] = useState('In step with the room');
  const [floatingReactions, setFloatingReactions] = useState([]);
  const [cheerNotice, setCheerNotice] = useState(null);
  const [activeParticipantIndex, setActiveParticipantIndex] = useState(null);

  // 3D Tilt refs & states
  const windowRef = useRef(null);
  const visualizerCanvasRef = useRef(null);
  const nextReactionId = useRef(1);

  // Format seconds to mm:ss
  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Playback timer ticker
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setCurrentTime((prev) => {
        if (prev >= totalDuration) return 0;
        return prev + 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isPlaying, totalDuration]);

  // Audio Equalizer Canvas animation
  useEffect(() => {
    const canvas = visualizerCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId;
    let phase = 0;
    const barCount = 28;

    const render = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      if (isPlaying) {
        phase += 0.055;
      }

      const barWidth = (w - (barCount - 1) * 3) / barCount;

      for (let i = 0; i < barCount; i++) {
        // Multi-frequency sine harmonics for organic audio wave
        const freq1 = Math.sin(phase * 1.8 + i * 0.3);
        const freq2 = Math.cos(phase * 2.6 - i * 0.4);
        const freq3 = Math.sin(phase * 0.8 + i * 0.15);

        let heightFactor = isPlaying ? (freq1 + freq2 + freq3 + 3) / 6 : 0.08;
        heightFactor = Math.max(0.06, Math.min(0.95, heightFactor));

        const barHeight = heightFactor * (h * 0.65);
        const x = i * (barWidth + 3);
        const y = (h - barHeight) / 2;

        // Gradient from warm amber to coral
        const grad = ctx.createLinearGradient(0, y, 0, y + barHeight);
        grad.addColorStop(0, '#f2a65a');
        grad.addColorStop(1, '#ef7b6a');

        ctx.fillStyle = grad;
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(x, y, barWidth, barHeight, 3);
        } else {
          ctx.rect(x, y, barWidth, barHeight);
        }
        ctx.fill();
      }

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [isPlaying]);

  // 3D Card Tilt on Mouse Move
  const handleMouseMove = (e) => {
    if (!windowRef.current) return;
    const rect = windowRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = ((y - centerY) / centerY) * -6; // max 6deg
    const rotateY = ((x - centerX) / centerX) * 6;

    windowRef.current.style.transform = `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) scale3d(1.015, 1.015, 1.015)`;
    windowRef.current.style.setProperty('--glare-x', `${(x / rect.width) * 100}%`);
    windowRef.current.style.setProperty('--glare-y', `${(y / rect.height) * 100}%`);
  };

  const handleMouseLeave = () => {
    if (!windowRef.current) return;
    windowRef.current.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
  };

  // Spawn floating reactions
  const spawnReaction = useCallback((emoji, sourceX = null) => {
    const id = nextReactionId.current++;
    const randomOffset = sourceX !== null ? sourceX : 20 + Math.random() * 60;
    const newReaction = {
      id,
      emoji,
      left: randomOffset,
      rotation: (Math.random() - 0.5) * 40,
      scale: 0.9 + Math.random() * 0.4,
    };

    setFloatingReactions((prev) => [...prev.slice(-15), newReaction]);

    setTimeout(() => {
      setFloatingReactions((prev) => prev.filter((r) => r.id !== id));
    }, 1800);
  }, []);

  // Screen click spawns reaction directly where clicked
  const handleScreenClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const xPercent = ((e.clientX - rect.left) / rect.width) * 100;
    const randomEmoji = REACTIONS[Math.floor(Math.random() * REACTIONS.length)];
    spawnReaction(randomEmoji, xPercent);
  };

  // Interactive scrubber seek
  const handleScrubberClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    const newTime = Math.floor(percentage * totalDuration);
    setCurrentTime(newTime);
    setSyncMessage(`Seeked to ${formatTime(newTime)}`);
    setTimeout(() => setSyncMessage('In step with the room'), 1500);
  };

  // Simulate real-time sync wave
  const simulateSyncDrift = () => {
    setSyncStatus('syncing');
    setSyncMessage('⚡️ Compensating +1.2s drift...');

    setTimeout(() => {
      setSyncStatus('synced');
      setSyncMessage('✨ Perfect sync · 14ms latency');
      spawnReaction('⚡️', 50);

      setTimeout(() => {
        setSyncMessage('In step with the room');
      }, 2500);
    }, 1100);
  };

  // Cheer participant
  const handleCheer = (name) => {
    spawnReaction('🎉');
    setCheerNotice(`Cheered ${name}!`);
    setTimeout(() => setCheerNotice(null), 1800);
  };

  const progressPercent = ((currentTime / totalDuration) * 100).toFixed(1);

  return (
    <figure className="preview" aria-label="Interactive illustration of a Sidelight watch room">
      <div
        ref={windowRef}
        className="preview__window preview__window--interactive"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <div className="preview__glare" aria-hidden="true" />

        {/* Room Header Bar */}
        <div className="preview__bar">
          <div className="preview__bar-left">
            <span className="preview__code">ROOM · K7QX2-M9WTA</span>
            <span className="preview__pill-interactive">Interactive Demo</span>
          </div>
          <div className="preview__bar-right">
            <button
              type="button"
              className="sync-trigger-btn"
              onClick={simulateSyncDrift}
              title="Click to simulate real-time room synchronization"
            >
              <Zap size={13} className={syncStatus === 'syncing' ? 'spin-pulse' : ''} />
              <span>{syncStatus === 'syncing' ? 'Syncing...' : 'Test Sync'}</span>
            </button>
            <span className="conn-badge conn-badge--connected">
              <span className="conn-badge__label">Connected</span>
            </span>
          </div>
        </div>

        {/* Room Stage & Sidebar */}
        <div className="preview__body">
          <div className="preview__stage">
            {/* Interactive Screen Display */}
            <div
              className={`preview__screen preview__screen--interactive ${isPlaying ? 'preview__screen--playing' : ''}`}
              onClick={handleScreenClick}
              title="Click anywhere on screen to send a reaction!"
            >
              <span className="preview__glow" />

              {/* Dynamic Equalizer Visualizer */}
              <canvas
                ref={visualizerCanvasRef}
                className="preview__visualizer-canvas"
                width={360}
                height={120}
              />

              {/* Now Playing overlay banner */}
              <div className="preview__screen-overlay">
                <span className="preview__screen-tag">
                  <Radio size={12} className={isPlaying ? 'icon-pulse' : ''} />
                  <span>Lo-Fi Cinema Night · 4K 60fps</span>
                </span>
                <button
                  type="button"
                  className="preview__sound-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMuted(!isMuted);
                  }}
                  title={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                </button>
              </div>

              {/* Center Play Overlay Icon */}
              <button
                type="button"
                className={`preview__center-play ${isPlaying ? 'preview__center-play--playing' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsPlaying(!isPlaying);
                }}
                aria-label={isPlaying ? 'Pause video' : 'Play video'}
              >
                {isPlaying ? <Pause size={22} /> : <Play size={22} />}
              </button>

              {/* Floating Live Reaction Particles */}
              <div className="preview__floating-container" aria-hidden="true">
                {floatingReactions.map((r) => (
                  <span
                    key={r.id}
                    className="preview__floating-reaction"
                    style={{
                      left: `${r.left}%`,
                      transform: `rotate(${r.rotation}deg) scale(${r.scale})`,
                    }}
                  >
                    {r.emoji}
                  </span>
                ))}
              </div>

              {/* Click prompt hint */}
              <div className="preview__click-hint" aria-hidden="true">
                <Sparkles size={11} /> Tap screen to react
              </div>
            </div>

            {/* Playback Status Row */}
            <div className="preview__row">
              <span className={`status-pill ${isPlaying ? 'status-pill--playing' : 'status-pill--paused'}`}>
                <span className="status-pill__dot" />
                {isPlaying ? 'Playing for everyone' : 'Paused by Host'}
              </span>
              <span className={`sync-note ${syncStatus === 'syncing' ? 'sync-note--syncing' : 'sync-note--synced'}`}>
                {syncMessage}
              </span>
            </div>

            {/* Interactive Transport Controls */}
            <div className="preview__transport">
              <button
                type="button"
                className="play-btn play-btn--interactive"
                onClick={() => setIsPlaying(!isPlaying)}
                aria-label={isPlaying ? 'Pause' : 'Play'}
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause size={16} /> : <Play size={16} />}
              </button>

              {/* Interactive Scrubbing Bar */}
              <div
                className="scrubber scrubber--interactive"
                onClick={handleScrubberClick}
                style={{ '--progress': `${progressPercent}%` }}
                title="Click anywhere to scrub playback position"
                role="slider"
                aria-valuenow={currentTime}
                aria-valuemin={0}
                aria-valuemax={totalDuration}
                aria-label="Seek time"
              >
                <div className="scrubber__track">
                  <div className="scrubber__fill" style={{ width: `${progressPercent}%` }} />
                  <div className="scrubber__thumb" style={{ left: `${progressPercent}%` }} />
                </div>
              </div>

              {/* Time display */}
              <span className="preview__time-display">
                {formatTime(currentTime)} / {formatTime(totalDuration)}
              </span>
            </div>

            {/* Quick Live Reaction Bar */}
            <div className="preview__reaction-bar">
              <span className="preview__reaction-label">Quick react:</span>
              <div className="preview__reaction-buttons">
                {REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className="reaction-bubble-btn"
                    onClick={() => spawnReaction(emoji)}
                    aria-label={`Send ${emoji} reaction`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Interactive Participants Rail */}
          <div className="preview__rail-wrap">
            <span className="preview__rail-header">In Room ({SAMPLE_PARTICIPANTS.length})</span>
            <ul className="preview__rail">
              {SAMPLE_PARTICIPANTS.map((p, idx) => (
                <li
                  key={p.name}
                  className={`person person--interactive ${activeParticipantIndex === idx ? 'person--active' : ''} ${syncStatus === 'syncing' ? 'person--sync-pulse' : ''}`}
                  onClick={() => handleCheer(p.name)}
                  onMouseEnter={() => setActiveParticipantIndex(idx)}
                  onMouseLeave={() => setActiveParticipantIndex(null)}
                  title={`Click to cheer ${p.name}! Ping: ${p.ping}`}
                >
                  <div className="person__avatar-wrap">
                    <Avatar name={p.name} size={28} />
                    <span className="person__online-dot" />
                  </div>
                  <div className="person__text">
                    <div className="person__name-row">
                      <span className="person__name">{p.name}</span>
                      <span className="person__ping">{p.ping}</span>
                    </div>
                    <RoleBadge role={p.role} />
                    <span className="person__status-text">{p.status}</span>
                  </div>
                </li>
              ))}
            </ul>

            {cheerNotice && (
              <div className="preview__cheer-toast" role="status">
                <Check size={12} /> {cheerNotice}
              </div>
            )}
          </div>
        </div>
      </div>

      <figcaption className="preview__caption">
        <Lock size={13} aria-hidden="true" />
        <span>Try clicking the video, reactions, scrubber, or <strong>Test Sync</strong> above!</span>
      </figcaption>
    </figure>
  );
}
