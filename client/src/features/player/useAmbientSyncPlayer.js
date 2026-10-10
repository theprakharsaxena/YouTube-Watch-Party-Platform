import { useEffect, useRef } from 'react';
import { YouTubePlayerController } from './youtubePlayer.js';

/**
 * Creates and maintains a secondary, muted, synchronized YouTube player
 * that runs behind the card. Provides true, 1:1 real-time frame-accurate
 * video lighting that reacts instantly to video scene cuts and colors.
 */
export default function useAmbientSyncPlayer({ videoId, playing, position, enabled }) {
  const hostRef = useRef(null);
  const controllerRef = useRef(null);
  const isReadyRef = useRef(false);

  useEffect(() => {
    if (!enabled || !videoId || typeof document === 'undefined') {
      if (controllerRef.current) {
        controllerRef.current.destroy();
        controllerRef.current = null;
        isReadyRef.current = false;
      }
      return undefined;
    }

    const host = hostRef.current;
    if (!host) return undefined;

    let active = true;

    const controller = new YouTubePlayerController(
      host,
      {
        onReady: () => {
          if (!active) return;
          isReadyRef.current = true;
          controller.mute();
          controller.setVolume(0);

          if (typeof position === 'number' && position > 0) {
            controller.seekTo(position);
          }
          if (playing) {
            controller.play();
          } else {
            controller.pause();
          }
        },
        onError: () => {
          /* Silent fallback to base ambient layer on error */
        },
        onLoadFailed: () => {
          /* Silent fallback to base ambient layer */
        },
      },
      {
        playerVars: {
          mute: 1,
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          rel: 0,
          showinfo: 0,
          iv_load_policy: 3,
        },
      }
    );

    controllerRef.current = controller;
    controller.init(videoId);

    return () => {
      active = false;
      isReadyRef.current = false;
      controller.destroy();
      controllerRef.current = null;
    };
  }, [enabled, videoId]);

  // Sync play/pause state
  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller || !isReadyRef.current) return;
    if (playing) {
      controller.mute();
      controller.setVolume(0);
      controller.play();
    } else {
      controller.pause();
    }
  }, [playing]);

  // Sync position on seek / drift
  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller || !isReadyRef.current || typeof position !== 'number') return;
    const current = controller.getCurrentTime();
    if (Math.abs(current - position) > 0.8) {
      controller.seekTo(position);
    }
  }, [position]);

  return hostRef;
}
