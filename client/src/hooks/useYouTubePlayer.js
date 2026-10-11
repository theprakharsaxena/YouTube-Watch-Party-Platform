import { useEffect, useRef, useState } from 'react';
import { YouTubePlayerController } from '../features/player/youtubePlayer.js';

export function useYouTubePlayer(initialVideoId = undefined) {
  const hostRef = useRef(null);
  const [controller, setController] = useState(null);
  const [ready, setReady] = useState(false);
  const [playerState, setPlayerState] = useState(-1);
  const [playerError, setPlayerError] = useState(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    const instance = new YouTubePlayerController(host, {
      onReady: () => setReady(true),
      onLoadFailed: () => setLoadFailed(true),
      onError: (error) => setPlayerError(error),
      onStateChange: (state) => {
        setPlayerState(state);

        const nextTitle = instance.getTitle();
        if (nextTitle) setTitle(nextTitle);
        const nextDuration = instance.getDuration();
        if (nextDuration > 0) setDuration(nextDuration);
        if (state === 1 || state === 3) setPlayerError(null);
      },
    });
    setController(instance);
    instance.init(initialVideoId);

    return () => {
      instance.destroy();
      setController(null);
      setReady(false);
    };
  }, []);

  const clearError = () => setPlayerError(null);

  return { hostRef, controller, ready, playerState, playerError, clearError, loadFailed, title, duration };
}

