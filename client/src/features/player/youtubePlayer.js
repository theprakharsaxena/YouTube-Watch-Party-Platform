// Thin, React-free wrapper around the official YouTube IFrame Player API.
// Components never touch `window.YT`; they use this controller (via useYouTubePlayer).

export const PlayerState = Object.freeze({
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
});

const API_SRC = 'https://www.youtube.com/iframe_api';
const API_TIMEOUT_MS = 15000;
let apiPromise = null;

/** Load the IFrame API script exactly once; resolves with window.YT. */
export function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;

  apiPromise = new Promise((resolve, reject) => {
    if (window.YT?.Player) {
      resolve(window.YT);
      return;
    }

    const checkInterval = setInterval(() => {
      if (window.YT?.Player) {
        clearInterval(checkInterval);
        clearTimeout(timer);
        resolve(window.YT);
      }
    }, 100);

    const timer = setTimeout(() => {
      clearInterval(checkInterval);
      apiPromise = null;
      reject(new Error('YouTube API timed out'));
    }, API_TIMEOUT_MS);

    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      clearInterval(checkInterval);
      clearTimeout(timer);
      previous?.();
      resolve(window.YT);
    };

    if (!document.querySelector(`script[src="${API_SRC}"]`)) {
      const script = document.createElement('script');
      script.src = API_SRC;
      script.async = true;
      script.onerror = () => {
        clearInterval(checkInterval);
        clearTimeout(timer);
        apiPromise = null;
        script.remove();
        reject(new Error('YouTube API failed to load'));
      };
      document.head.appendChild(script);
    }
  });
  return apiPromise;
}

const ERROR_MESSAGES = {
  2: 'YouTube could not read that video link.',
  5: 'Your browser could not play this video.',
  100: 'This video was removed or is private.',
  101: 'The owner of this video does not allow it to be played outside YouTube.',
  150: 'The owner of this video does not allow it to be played outside YouTube.',
};

export function describePlayerError(code) {
  return ERROR_MESSAGES[code] || 'This video could not be played.';
}

/**
 * Operations are safe to call at any time: they are no-ops until the player is ready,
 * and after destroy(). The owner is told about readiness through callbacks.
 */
export class YouTubePlayerController {
  #player = null;
  #ready = false;
  #destroyed = false;

  /**
   * @param {HTMLElement} host  container that the API will fill with an iframe
   * @param {{onReady?:Function,onStateChange?:Function,onError?:Function,onLoadFailed?:Function}} handlers
   */
  constructor(host, handlers = {}, options = {}) {
    this.host = host;
    this.handlers = handlers;
    this.options = options;
  }

  async init(videoId = undefined) {
    let YT;
    try {
      YT = await loadYouTubeApi();
    } catch (error) {
      if (!this.#destroyed) this.handlers.onLoadFailed?.(error);
      return;
    }
    if (this.#destroyed) return;

    // The API replaces its target node, so give it a throwaway child to own.
    const mount = document.createElement('div');
    this.host.appendChild(mount);
    this.#player = new YT.Player(mount, {
      width: '100%',
      height: '100%',
      videoId,
      playerVars: {
        enablejsapi: 1,
        controls: 0, // all control goes through Sidelight so it can be role-checked
        disablekb: 1,
        rel: 0,
        showinfo: 0,
        autohide: 1,
        playsinline: 1,
        modestbranding: 1,
        iv_load_policy: 3,
        fs: 0,
        origin: window.location.origin,
        ...(this.options?.playerVars || {}),
      },
      events: {
        onReady: () => {
          if (this.#destroyed) return;
          this.#ready = true;
          this.handlers.onReady?.();
        },
        onStateChange: (event) => !this.#destroyed && this.handlers.onStateChange?.(event.data),
        onError: (event) =>
          !this.#destroyed && this.handlers.onError?.({ code: event.data, message: describePlayerError(event.data) }),
      },
    });
  }

  get ready() {
    return this.#ready && !this.#destroyed;
  }

  #call(method, ...args) {
    if (!this.ready) return undefined;
    try {
      return this.#player[method]?.(...args);
    } catch {
      return undefined;
    }
  }

  load(videoId, startSeconds = 0, autoplay = false) {
    const options = { videoId, startSeconds: Math.max(0, startSeconds) };
    return autoplay ? this.#call('loadVideoById', options) : this.#call('cueVideoById', options);
  }

  play() {
    this.#call('playVideo');
  }

  pause() {
    this.#call('pauseVideo');
  }

  seekTo(seconds) {
    this.#call('seekTo', Math.max(0, seconds), true);
  }

  mute() {
    this.#call('mute');
  }

  unMute() {
    this.#call('unMute');
  }

  setVolume(volume) {
    this.#call('setVolume', volume);
  }

  isMuted() {
    return Boolean(this.#call('isMuted'));
  }

  getCurrentTime() {
    return this.#call('getCurrentTime') ?? 0;
  }

  getDuration() {
    return this.#call('getDuration') ?? 0;
  }

  getState() {
    return this.#call('getPlayerState') ?? PlayerState.UNSTARTED;
  }

  getTitle() {
    return this.#call('getVideoData')?.title || '';
  }

  destroy() {
    this.#destroyed = true;
    this.#ready = false;
    try {
      this.#player?.destroy();
    } catch {
      /* iframe already gone */
    }
    this.#player = null;
    this.host.replaceChildren();
  }
}
