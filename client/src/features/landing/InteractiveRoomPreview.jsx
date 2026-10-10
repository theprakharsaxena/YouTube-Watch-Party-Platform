import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  Lock,
  Sparkles,
  Volume2,
  VolumeX,
  Radio,
  Check,
  Zap,
  Film,
  Link as LinkIcon,
  X,
  AlertTriangle,
} from 'lucide-react';
import Avatar from '../../components/Avatar.jsx';
import RoleBadge from '../../components/RoleBadge.jsx';
import { YouTubePlayerController, PlayerState } from '../player/youtubePlayer.js';
import { extractVideoId } from '../../utils/youtube.js';

const SAMPLE_PARTICIPANTS = [
  { name: 'Hana', role: 'host', status: 'Broadcasting remote', ping: '12ms' },
  { name: 'Ines', role: 'moderator', status: 'Queue approved', ping: '18ms' },
  { name: 'Theo', role: 'participant', status: 'Buffered 100%', ping: '24ms' },
];

const REACTIONS = ['🍿', '🔥', '❤️', '🚀', '👏', '✨'];

const PRESET_VIDEOS = [
  { id: 'LXb3EKWsInQ', label: '🌿 4K Nature', title: 'COSTA RICA IN 4K 60fps HDR' },
  { id: '60ItHLz5WEA', label: '🎧 Electro Chill', title: 'Alan Walker - Faded' },
  { id: 'dQw4w9WgXcQ', label: '🎵 Synth Pop', title: 'Rick Astley - Never Gonna Give You Up' },
  { id: 'aqz-KE-bpKQ', label: '🐰 Blender 4K', title: 'Big Buck Bunny 4K 60fps' },
];

export default function InteractiveRoomPreview() {
  const [videoId, setVideoId] = useState('LXb3EKWsInQ');
  const [videoTitle, setVideoTitle] = useState('COSTA RICA IN 4K 60fps HDR');
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(318);
  const [isMuted, setIsMuted] = useState(true);
  const [playerReady, setPlayerReady] = useState(false);
  const [playerError, setPlayerError] = useState(null);
  const [syncStatus, setSyncStatus] = useState('synced'); // 'synced' | 'syncing' | 'drift'
  const [syncMessage, setSyncMessage] = useState('In step with the room');
  const [floatingReactions, setFloatingReactions] = useState([]);
  const [cheerNotice, setCheerNotice] = useState(null);
  const [activeParticipantIndex, setActiveParticipantIndex] = useState(null);

  // Video URL Input Drawer
  const [showUrlDrawer, setShowUrlDrawer] = useState(false);
  const [inputUrl, setInputUrl] = useState('');
  const [urlError, setUrlError] = useState('');

  // 3D Tilt refs & states
  const windowRef = useRef(null);
  const visualizerCanvasRef = useRef(null);
  const playerHostRef = useRef(null);
  const controllerRef = useRef(null);
  const nextReactionId = useRef(1);

  // Format seconds to mm:ss
  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Mount real YouTube player
  useEffect(() => {
    const host = playerHostRef.current;
    if (!host) return undefined;

    let destroyed = false;

    const instance = new YouTubePlayerController(
      host,
      {
        onReady: () => {
          if (destroyed) return;
          setPlayerReady(true);
          setPlayerError(null);
          instance.mute();
          setIsMuted(true);
          instance.play();
          setIsPlaying(true);
          const dur = instance.getDuration();
          if (dur > 0) setTotalDuration(Math.round(dur));
          const tit = instance.getTitle();
          if (tit) setVideoTitle(tit);
        },
        onStateChange: (state) => {
          if (destroyed) return;
          if (state === PlayerState.PLAYING) {
            setIsPlaying(true);
            setPlayerError(null);
            const d = instance.getDuration();
            if (d > 0) setTotalDuration(Math.round(d));
            const t = instance.getTitle();
            if (t) setVideoTitle(t);
          } else if (state === PlayerState.PAUSED) {
            setIsPlaying(false);
          } else if (state === PlayerState.ENDED) {
            setIsPlaying(false);
          }
        },
        onError: (err) => {
          if (destroyed) return;
          console.warn('InteractiveRoomPreview YouTube error:', err);
          setPlayerError(err?.message || 'This video cannot be played outside YouTube.');
          setIsPlaying(false);
        },
      },
      {
        playerVars: {
          mute: 1,
          autoplay: 1,
          controls: 0, // no YouTube UI (slider, share, logo)
          disablekb: 1,
          fs: 0,
          rel: 0,
          modestbranding: 1,
          iv_load_policy: 3,
        },
      }
    );

    controllerRef.current = instance;
    instance.init(videoId);

    return () => {
      destroyed = true;
      instance.destroy();
      controllerRef.current = null;
    };
  }, []); // Mount player once

  // Track playback position & duration from actual YouTube player
  useEffect(() => {
    if (!isPlaying) return undefined;
    const interval = setInterval(() => {
      const controller = controllerRef.current;
      if (controller?.ready) {
        const cur = controller.getCurrentTime();
        if (typeof cur === 'number' && !Number.isNaN(cur)) {
          setCurrentTime(Math.floor(cur));
        }
        const dur = controller.getDuration();
        if (dur > 0 && Math.floor(dur) !== totalDuration) {
          setTotalDuration(Math.floor(dur));
        }
        const tit = controller.getTitle();
        if (tit && tit !== videoTitle) {
          setVideoTitle(tit);
        }
      }
    }, 300);

    return () => clearInterval(interval);
  }, [isPlaying, totalDuration, videoTitle]);

  // Load a new video into player
  const loadVideo = (id, customTitle = null) => {
    setVideoId(id);
    setPlayerError(null);
    if (customTitle) setVideoTitle(customTitle);
    if (controllerRef.current?.ready) {
      controllerRef.current.load(id, 0, true);
      setIsPlaying(true);
      setCurrentTime(0);
    }
    setSyncMessage('Video loaded · Synced');
    setTimeout(() => setSyncMessage('In step with the room'), 2000);
    spawnReaction('🎬', 50);
  };

  // Handle URL submit
  const handleUrlSubmit = (e) => {
    e.preventDefault();
    const extracted = extractVideoId(inputUrl);
    if (!extracted) {
      setUrlError('Please enter a valid YouTube video link or ID');
      return;
    }
    loadVideo(extracted);
    setInputUrl('');
    setUrlError('');
    setShowUrlDrawer(false);
  };

  // Handle preset select
  const handleSelectPreset = (preset) => {
    loadVideo(preset.id, preset.title);
    setShowUrlDrawer(false);
  };

  // Play / Pause toggle
  const togglePlay = () => {
    if (!controllerRef.current) return;
    if (isPlaying) {
      controllerRef.current.pause();
      setIsPlaying(false);
    } else {
      controllerRef.current.play();
      setIsPlaying(true);
    }
  };

  // Mute / Unmute toggle
  const toggleMute = (e) => {
    e?.stopPropagation();
    if (!controllerRef.current) return;
    if (isMuted) {
      controllerRef.current.unMute();
      setIsMuted(false);
    } else {
      controllerRef.current.mute();
      setIsMuted(true);
    }
  };

  // Audio Equalizer Canvas animation
  useEffect(() => {
    const canvas = visualizerCanvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

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
        const freq1 = Math.sin(phase * 1.8 + i * 0.3);
        const freq2 = Math.cos(phase * 2.6 - i * 0.4);
        const freq3 = Math.sin(phase * 0.8 + i * 0.15);

        let heightFactor = isPlaying ? (freq1 + freq2 + freq3 + 3) / 6 : 0.08;
        heightFactor = Math.max(0.06, Math.min(0.95, heightFactor));

        const barHeight = heightFactor * (h * 0.65);
        const x = i * (barWidth + 3);
        const y = (h - barHeight) / 2;

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

    const rotateX = ((y - centerY) / centerY) * -3; // max 3deg (softened tilt)
    const rotateY = ((x - centerX) / centerX) * 3;

    windowRef.current.style.transform = `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) scale3d(1.008, 1.008, 1.008)`;
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

  // Interactive scrubber seek on real player
  const handleScrubberClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    const newTime = Math.floor(percentage * totalDuration);
    setCurrentTime(newTime);
    controllerRef.current?.seekTo(newTime);
    setSyncMessage(`Seeked to ${formatTime(newTime)}`);
    setTimeout(() => setSyncMessage('In step with the room'), 1500);
  };

  // Simulate real-time sync wave
  const simulateSyncDrift = () => {
    setSyncStatus('syncing');
    setSyncMessage('⚡️ Compensating +1.2s drift...');

    if (controllerRef.current && isPlaying) {
      const cur = controllerRef.current.getCurrentTime();
      controllerRef.current.seekTo(cur + 1.2);
    }

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

  const progressPercent = totalDuration > 0 ? ((currentTime / totalDuration) * 100).toFixed(1) : '0.0';

  return (
    <figure className="preview" aria-label="Interactive demonstration of a Sidelight watch room">
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
              className={`video-input-toggle-btn ${showUrlDrawer ? 'video-input-toggle-btn--active' : ''}`}
              onClick={() => setShowUrlDrawer(!showUrlDrawer)}
              title="Paste your own YouTube video link"
            >
              <Film size={12} />
              <span>Change Video</span>
            </button>
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

        {/* URL Input & Presets Drawer */}
        {showUrlDrawer && (
          <div className="preview__drawer">
            <form className="preview__url-form" onSubmit={handleUrlSubmit}>
              <div className="preview__url-input-wrap">
                <LinkIcon size={14} className="preview__url-icon" />
                <input
                  type="text"
                  className="preview__url-input"
                  placeholder="Paste any YouTube video link (e.g. https://youtu.be/...)"
                  value={inputUrl}
                  onChange={(e) => {
                    setInputUrl(e.target.value);
                    if (urlError) setUrlError('');
                  }}
                  autoFocus
                />
              </div>
              <button type="submit" className="preview__url-btn">
                Load Video
              </button>
              <button
                type="button"
                className="preview__url-close"
                onClick={() => setShowUrlDrawer(false)}
                aria-label="Close"
              >
                <X size={14} />
              </button>
            </form>
            {urlError && <div className="preview__url-error">{urlError}</div>}
            <div className="preview__presets">
              <span className="preview__presets-label">Quick presets:</span>
              {PRESET_VIDEOS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={`preview__preset-chip ${videoId === preset.id ? 'preview__preset-chip--active' : ''}`}
                  onClick={() => handleSelectPreset(preset)}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Room Stage & Sidebar */}
        <div className="preview__body">
          <div className="preview__stage">
            {/* Interactive Screen Display */}
            <div
              className={`preview__screen preview__screen--interactive ${isPlaying ? 'preview__screen--playing' : ''}`}
            >
              <span className="preview__glow" />

              {/* Actual YouTube Player Mount */}
              <div
                className={`preview__player-wrap ${!isPlaying ? 'preview__player-wrap--paused' : ''}`}
                style={{ '--poster': `url(https://i.ytimg.com/vi/${videoId}/hqdefault.jpg)` }}
              >
                <div ref={playerHostRef} className="preview__player-host" />
              </div>

              {/* Invisible layer: blocks YouTube's hover UI; click toggles play */}
              <div className="preview__shield" onClick={togglePlay} />

              {/* Error overlay if a video is restricted */}
              {playerError && (
                <div className="preview__error-overlay">
                  <AlertTriangle size={24} className="preview__error-icon" />
                  <span className="preview__error-title">Video playback restricted</span>
                  <span className="preview__error-sub">{playerError}</span>
                  <button
                    type="button"
                    className="preview__error-reset-btn"
                    onClick={() => loadVideo('LXb3EKWsInQ', 'COSTA RICA IN 4K 60fps HDR')}
                  >
                    Revert to 4K Nature Demo
                  </button>
                </div>
              )}

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

            </div>

            {/* Playback Status Row */}
            <div className="preview__row">
              <span className={`status-pill ${isPlaying ? 'status-pill--playing' : 'status-pill--paused'}`}>
                <span className="status-pill__dot" />
                {isPlaying ? 'Playing actual YouTube stream' : playerError ? 'Playback error' : 'Paused by Host'}
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
                onClick={togglePlay}
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
                title="Click anywhere to scrub playback position in real YouTube video"
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

              {/* Custom sound on/off toggle */}
              <button
                type="button"
                className="sound-toggle-btn"
                onClick={toggleMute}
                aria-label={isMuted ? 'Turn sound on' : 'Turn sound off'}
                aria-pressed={!isMuted}
                title={isMuted ? 'Sound off · click to turn on' : 'Sound on · click to turn off'}
              >
                {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
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
        <span>Playing real YouTube video. Click <strong>Change Video</strong> to paste any link, or tap the video to react!</span>
      </figcaption>
    </figure>
  );
}
