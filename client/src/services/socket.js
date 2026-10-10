import { io } from 'socket.io-client';
import { SERVER_URL } from './api.js';

let socket = null;

/** One lazily-created socket for the whole app. Reconnection is handled by socket.io. */
export function getSocket() {
  if (!socket) {
    socket = io(SERVER_URL || undefined, {
      autoConnect: false,
      auth: (cb) => {
        try {
          const token = localStorage.getItem('sidelight_auth_token');
          cb({ token: token || undefined });
        } catch {
          cb({});
        }
      },
      transports: ['websocket', 'polling'],
      reconnectionDelayMax: 5000,
    });
  }
  return socket;
}

// Lightweight session identity, kept per tab so two tabs can be two different people.
// The token only proves "same browser session as before"; roles always come from the server.
const key = (roomId) => `sidelight:session:${roomId}`;

export function loadSession(roomId) {
  try {
    return JSON.parse(sessionStorage.getItem(key(roomId)) || 'null');
  } catch {
    return null;
  }
}

export function saveSession(roomId, session) {
  try {
    sessionStorage.setItem(key(roomId), JSON.stringify(session));
  } catch {
    /* storage unavailable: reconnect-after-refresh simply won't work */
  }
}

export function clearSession(roomId) {
  try {
    sessionStorage.removeItem(key(roomId));
  } catch {
    /* ignore */
  }
}
