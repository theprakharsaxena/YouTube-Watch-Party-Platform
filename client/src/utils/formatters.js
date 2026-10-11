export function formatTime(totalSeconds) {
  const safe = Number.isFinite(totalSeconds) && totalSeconds > 0 ? Math.floor(totalSeconds) : 0;
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export function formatRoomCode(roomId = '') {
  return roomId.length === 10 ? `${roomId.slice(0, 5)}-${roomId.slice(5)}` : roomId;
}

export function parseRoomInput(input) {
  if (typeof input !== 'string') return null;
  let text = input.trim();
  const match = text.match(/\/r\/([^/?#\s]+)/i);
  if (match) text = match[1];
  const code = text.replace(/[\s-]/g, '').toUpperCase();
  return /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{10}$/.test(code) ? code : null;
}

export function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export const ROLE_LABELS = { host: 'Host', moderator: 'Moderator', participant: 'Participant', viewer: 'Viewer' };

