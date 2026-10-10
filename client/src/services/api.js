// Where the backend lives.
// Dev: empty string -> same origin, proxied by Vite (see vite.config.js).
// Prod: VITE_SERVER_URL=https://your-backend.onrender.com
export const SERVER_URL = (import.meta.env.VITE_SERVER_URL || '').replace(/\/$/, '');

/** Check whether a room exists before opening a socket. */
export async function fetchRoomInfo(roomId, { signal } = {}) {
  let response;
  try {
    response = await fetch(`${SERVER_URL}/api/rooms/${encodeURIComponent(roomId)}`, { signal });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw { code: 'NETWORK', message: 'Could not reach the Sidelight server. Check your connection and try again.' };
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw { code: body.code || 'ERROR', message: body.message || 'Could not look up that room.' };
  }
  return body;
}
