import { useState, useEffect } from 'react';
import { Play, Pause, FastForward, Server, Laptop, Wifi, CheckCircle2 } from 'lucide-react';

export default function InteractiveSyncFlow() {
  const [activeAction, setActiveAction] = useState('play');
  const [animating, setAnimating] = useState(false);
  const [serverState, setServerState] = useState({
    videoState: 'PLAYING',
    timestamp: '01:24',
    latency: '18ms',
    driftStatus: 'Locked (±12ms)',
  });
  const [activePacket, setActivePacket] = useState(null);

  const triggerEvent = (actionType) => {
    if (animating) return;
    setActiveAction(actionType);
    setAnimating(true);

    if (actionType === 'play') {
      setActivePacket({ type: 'PLAY', text: 'SYNC_PLAY @ 01:25' });
      setServerState({
        videoState: 'PLAYING',
        timestamp: '01:25',
        latency: '16ms',
        driftStatus: 'Broadcasted to all 3 clients',
      });
    } else if (actionType === 'pause') {
      setActivePacket({ type: 'PAUSE', text: 'SYNC_PAUSE @ 01:25' });
      setServerState({
        videoState: 'PAUSED',
        timestamp: '01:25',
        latency: '14ms',
        driftStatus: 'All viewers paused synchronously',
      });
    } else if (actionType === 'seek') {
      setActivePacket({ type: 'SEEK', text: 'SYNC_SEEK @ 02:45' });
      setServerState({
        videoState: 'SEEKING',
        timestamp: '02:45',
        latency: '19ms',
        driftStatus: 'Buffer seek instruction dispatched',
      });
    } else if (actionType === 'drift') {
      setActivePacket({ type: 'DRIFT', text: 'DRIFT_DETECTED (+1.4s)' });
      setServerState({
        videoState: 'RESYNCING',
        timestamp: '01:27',
        latency: '22ms',
        driftStatus: 'Compensating network jitter (<1 frame)',
      });
    }

    setTimeout(() => {
      setAnimating(false);
      setActivePacket(null);
    }, 1600);
  };

  return (
    <div className="sync-flow">
      <div className="sync-flow__header">
        <div>
          <span className="sync-flow__badge">Interactive Simulator</span>
          <h3 className="sync-flow__title">Test the real-time sync engine</h3>
          <p className="sync-flow__subtitle">
            Click an action below to watch how state propagates from the Host through the Server to every connected viewer.
          </p>
        </div>
        <div className="sync-flow__controls">
          <button
            type="button"
            className={`sync-btn ${activeAction === 'play' ? 'sync-btn--active' : ''}`}
            onClick={() => triggerEvent('play')}
            disabled={animating}
          >
            <Play size={14} /> Send Play
          </button>
          <button
            type="button"
            className={`sync-btn ${activeAction === 'pause' ? 'sync-btn--active' : ''}`}
            onClick={() => triggerEvent('pause')}
            disabled={animating}
          >
            <Pause size={14} /> Send Pause
          </button>
          <button
            type="button"
            className={`sync-btn ${activeAction === 'seek' ? 'sync-btn--active' : ''}`}
            onClick={() => triggerEvent('seek')}
            disabled={animating}
          >
            <FastForward size={14} /> Seek +10s
          </button>
          <button
            type="button"
            className={`sync-btn sync-btn--accent ${activeAction === 'drift' ? 'sync-btn--active' : ''}`}
            onClick={() => triggerEvent('drift')}
            disabled={animating}
          >
            <Wifi size={14} /> Simulate Drift
          </button>
        </div>
      </div>

      <div className="sync-flow__stage">

        <div className={`sync-node sync-node--host ${animating ? 'sync-node--emitting' : ''}`}>
          <div className="sync-node__icon">
            <Laptop size={22} />
          </div>
          <span className="sync-node__label">Host (Hana)</span>
          <span className="sync-node__sub">Originates action</span>
        </div>

        <div className="sync-cable sync-cable--host-to-server">
          <div className="sync-cable__line" />
          {animating && (
            <div className="sync-packet sync-packet--upward">
              <span>{activePacket?.text}</span>
            </div>
          )}
        </div>

        <div className={`sync-node sync-node--server ${animating ? 'sync-node--processing' : ''}`}>
          <div className="sync-node__icon">
            <Server size={26} />
          </div>
          <span className="sync-node__label">WatchAlong Server</span>
          <div className="sync-node__telemetry">
            <span className="sync-node__status-badge">
              <span className="status-pill__dot" />
              {serverState.videoState}
            </span>
            <span className="sync-node__metric">Time: {serverState.timestamp}</span>
            <span className="sync-node__metric">RTT: {serverState.latency}</span>
          </div>
        </div>

        <div className="sync-cable sync-cable--server-to-viewers">
          <div className="sync-cable__fork" />
          {animating && (
            <>
              <div className="sync-packet sync-packet--downward sync-packet--left">
                <span>{serverState.videoState}</span>
              </div>
              <div className="sync-packet sync-packet--downward sync-packet--center">
                <span>{serverState.videoState}</span>
              </div>
              <div className="sync-packet sync-packet--downward sync-packet--right">
                <span>{serverState.videoState}</span>
              </div>
            </>
          )}
        </div>

        <div className="sync-flow__viewers">
          <div className={`sync-node sync-node--viewer ${animating ? 'sync-node--updated' : ''}`}>
            <div className="sync-node__icon">
              <Laptop size={18} />
            </div>
            <span className="sync-node__label">Ines (Mod)</span>
            <span className="sync-node__sub"><CheckCircle2 size={11} /> Synced</span>
          </div>
          <div className={`sync-node sync-node--viewer ${animating ? 'sync-node--updated' : ''}`}>
            <div className="sync-node__icon">
              <Laptop size={18} />
            </div>
            <span className="sync-node__label">Theo (Viewer)</span>
            <span className="sync-node__sub"><CheckCircle2 size={11} /> Synced</span>
          </div>
          <div className={`sync-node sync-node--viewer ${animating ? 'sync-node--updated' : ''}`}>
            <div className="sync-node__icon">
              <Laptop size={18} />
            </div>
            <span className="sync-node__label">Alex (Viewer)</span>
            <span className="sync-node__sub"><CheckCircle2 size={11} /> Synced</span>
          </div>
        </div>
      </div>

      <div className="sync-flow__footer">
        <span className="sync-flow__footer-note">
          <strong>Engine status:</strong> {serverState.driftStatus}
        </span>
      </div>
    </div>
  );
}

