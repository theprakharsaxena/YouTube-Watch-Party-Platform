import { useCallback, useEffect, useRef, useState } from 'react';
import { PlayerState } from './youtubePlayer.js';
import { SYNC_CONFIG, decideDriftAction, expectedPosition } from '../../utils/sync.js';

export function usePlaybackSync({ controller, ready, playback, receivedAt, playerState }) {
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  const [syncStatus, setSyncStatus] = useState('idle');
  const loadedVideoRef = useRef(null);
  const lastSeekAtRef = useRef(0);
  const moderatePendingRef = useRef(false);
  const latestRef = useRef({ playback, receivedAt });
  const applyingUntilRef = useRef(0);

  useEffect(() => {
    latestRef.current = { playback, receivedAt };
  });

  const isApplyingRemote = useCallback(() => Date.now() < applyingUntilRef.current, []);

  useEffect(() => {
    if (!ready || !controller || !playback.videoId) return undefined;
    const { playback: current, receivedAt: at } = latestRef.current;
    const target = expectedPosition(current, at);
    const shouldPlay = current.status === 'playing';
    applyingUntilRef.current = Date.now() + 1200;

    if (loadedVideoRef.current !== current.videoId) {
      loadedVideoRef.current = current.videoId;
      controller.load(current.videoId, target, shouldPlay);
    } else {
      const curTime = controller.getCurrentTime();
      if (Math.abs(curTime - target) > SYNC_CONFIG.commandSeekTolerance) {
        controller.seekTo(target);
        lastSeekAtRef.current = Date.now();
      }
      if (shouldPlay) {
        controller.play();
      } else {
        controller.pause();
        if (Math.abs(curTime - target) > 0.05) {
          controller.seekTo(target);
        }
      }
    }
    moderatePendingRef.current = false;

    if (!shouldPlay) {
      setAutoplayBlocked(false);
      return undefined;
    }

    const timer = setTimeout(() => {
      const state = controller.getState();
      if (state !== PlayerState.PLAYING && state !== PlayerState.BUFFERING) setAutoplayBlocked(true);
    }, SYNC_CONFIG.autoplayGraceMs);
    return () => clearTimeout(timer);
  }, [ready, controller, playback.videoId, playback.revision, playback.status]);

  useEffect(() => {
    if (playerState === PlayerState.PLAYING) setAutoplayBlocked(false);
  }, [playerState]);

  const notifySeek = useCallback((targetTime) => {
    lastSeekAtRef.current = Date.now();
    applyingUntilRef.current = Date.now() + 1500;
    moderatePendingRef.current = false;
    setSyncStatus('synced');
  }, []);

  useEffect(() => {
    if (!ready || !controller || playback.status !== 'playing') return undefined;
    const interval = setInterval(() => {
      if (controller.getState() !== PlayerState.PLAYING) return;
      const { playback: current, receivedAt: at } = latestRef.current;
      const target = expectedPosition(current, at);
      const drift = controller.getCurrentTime() - target;
      const sinceLastSeek = Date.now() - lastSeekAtRef.current;
      const decision = decideDriftAction({
        drift,
        moderatePending: moderatePendingRef.current,
        sinceLastSeekMs: sinceLastSeek,
      });
      moderatePendingRef.current = decision.moderatePending;
      if (sinceLastSeek < SYNC_CONFIG.seekCooldownMs) {
        setSyncStatus('synced');
      } else {
        setSyncStatus(Math.abs(drift) < SYNC_CONFIG.ignoreBelow ? 'synced' : 'adjusting');
      }
      if (decision.action === 'seek') {
        applyingUntilRef.current = Date.now() + 1200;
        controller.seekTo(target);
        lastSeekAtRef.current = Date.now();
      }
    }, SYNC_CONFIG.checkIntervalMs);
    return () => {
      clearInterval(interval);
      setSyncStatus('idle');
    };
  }, [ready, controller, playback.status]);

  const resumeFromGesture = useCallback(() => {
    if (!controller) return;
    const { playback: current, receivedAt: at } = latestRef.current;
    controller.seekTo(expectedPosition(current, at));
    controller.play();
    setAutoplayBlocked(false);
  }, [controller]);

  return { autoplayBlocked, resumeFromGesture, isApplyingRemote, syncStatus, notifySeek };
}

