import { AppError, ErrorCodes } from '../utils/errors.js';
import { Roles } from '../auth/permissions.js';

// Room codes avoid look-alike characters (0/O, 1/I/L).
export const ROOM_ID_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const ROOM_ID_LENGTH = 10;
const ROOM_ID_PATTERN = new RegExp(`^[${ROOM_ID_ALPHABET}]{${ROOM_ID_LENGTH}}$`);
const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
]);

export function assertPayloadObject(payload) {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new AppError(ErrorCodes.INVALID_PAYLOAD, 'Malformed request.');
  }
  return payload;
}

export function sanitizeDisplayName(value, maxLength) {
  if (typeof value !== 'string') throw new AppError(ErrorCodes.INVALID_NAME, 'Enter a display name.');
  // Collapse whitespace and strip control characters.
  const name = value.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim();
  if (name.length < 1) throw new AppError(ErrorCodes.INVALID_NAME, 'Enter a display name.');
  if (name.length > maxLength) {
    throw new AppError(ErrorCodes.INVALID_NAME, `Display names can be at most ${maxLength} characters.`);
  }
  return name;
}

/** Accepts "abcde-fghjk", lowercase, spaces. Returns canonical form or throws. */
export function normalizeRoomId(value) {
  if (typeof value !== 'string') throw new AppError(ErrorCodes.INVALID_ROOM, 'Enter a valid room code.');
  const id = value.replace(/[\s-]/g, '').toUpperCase();
  if (!ROOM_ID_PATTERN.test(id)) throw new AppError(ErrorCodes.INVALID_ROOM, 'That does not look like a room code.');
  return id;
}

/**
 * Extract an 11-character YouTube video ID from a URL or a bare ID.
 * Pure string parsing: the server never fetches user-supplied URLs.
 * Returns null when no valid ID is found.
 */
export function extractVideoId(input) {
  if (typeof input !== 'string') return null;
  const text = input.trim();
  if (!text || text.length > 300) return null;
  if (VIDEO_ID_PATTERN.test(text)) return text;

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
  } else if (YOUTUBE_HOSTS.has(host)) {
    const [, first, second] = url.pathname.split('/');
    if (first === 'watch') candidate = url.searchParams.get('v');
    else if (['embed', 'shorts', 'live', 'v'].includes(first)) candidate = second;
  }
  return candidate && VIDEO_ID_PATTERN.test(candidate) ? candidate : null;
}

/** Optional video input (create_room). Returns null when empty, throws when present but invalid. */
export function parseOptionalVideo(input) {
  if (input === undefined || input === null || (typeof input === 'string' && input.trim() === '')) return null;
  const id = extractVideoId(input);
  if (!id) throw new AppError(ErrorCodes.INVALID_VIDEO, 'That is not a supported YouTube link.');
  return id;
}

export function parseRequiredVideo(input) {
  const id = extractVideoId(input);
  if (!id) throw new AppError(ErrorCodes.INVALID_VIDEO, 'That is not a supported YouTube link.');
  return id;
}

export function parsePosition(value, maxSeconds) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > maxSeconds) {
    throw new AppError(ErrorCodes.INVALID_POSITION, 'That playback position is not valid.');
  }
  return value;
}

export function parseAssignableRole(value) {
  if (![Roles.HOST, Roles.MODERATOR, Roles.PARTICIPANT, Roles.VIEWER].includes(value)) {
    throw new AppError(ErrorCodes.INVALID_ROLE, 'Unknown role.');
  }
  return value;
}

export function parseId(value, label = 'participant') {
  if (typeof value !== 'string' || value.length < 1 || value.length > 64) {
    throw new AppError(ErrorCodes.INVALID_PAYLOAD, `Invalid ${label}.`);
  }
  return value;
}

export function parseOptionalToken(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.length > 128) {
    throw new AppError(ErrorCodes.INVALID_PAYLOAD, 'Invalid session token.');
  }
  return value;
}
