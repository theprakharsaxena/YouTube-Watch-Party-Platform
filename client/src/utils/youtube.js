const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
]);

/**
 * Extract an 11-char video ID from a watch URL, youtu.be link, embed/shorts/live URL
 * or a bare ID. Returns null if unsupported. (Mirrors the server's validator, which is
 * the authority; this copy only gives instant form feedback.)
 */
export function extractVideoId(input) {
  if (typeof input !== 'string') return null;
  const text = input.trim();
  if (!text || text.length > 300) return null;
  if (VIDEO_ID.test(text)) return text;

  let url;
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;

  const host = url.hostname.toLowerCase();
  let candidate = null;
  if (host === 'youtu.be') {
    candidate = url.pathname.split('/')[1];
  } else if (HOSTS.has(host)) {
    const [, first, second] = url.pathname.split('/');
    if (first === 'watch') candidate = url.searchParams.get('v');
    else if (['embed', 'shorts', 'live', 'v'].includes(first)) candidate = second;
  }
  return candidate && VIDEO_ID.test(candidate) ? candidate : null;
}

export const VIDEO_URL_HINT = 'Paste a youtube.com or youtu.be link.';

/** Validate an optional/required video field. Returns an error string or ''. */
export function validateVideoInput(value, { required = false } = {}) {
  if (!value.trim()) return required ? 'Paste a YouTube link.' : '';
  return extractVideoId(value) ? '' : 'That is not a supported YouTube link.';
}
