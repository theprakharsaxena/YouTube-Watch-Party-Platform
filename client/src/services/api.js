
export const SERVER_URL = (import.meta.env.VITE_SERVER_URL || '').replace(/\/$/, '');

export async function fetchRoomInfo(roomId, { signal } = {}) {
  let response;
  try {
    const headers = {};
    const token = localStorage.getItem('watchalong_auth_token') || localStorage.getItem('sidelight_auth_token');
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    response = await fetch(`${SERVER_URL}/api/rooms/${encodeURIComponent(roomId)}`, {
      headers,
      signal,
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw { code: 'NETWORK', message: 'Could not reach the WatchAlong server. Check your connection and try again.' };
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw { code: body.code || 'ERROR', message: body.message || 'Could not look up that room.' };
  }
  return body;
}

