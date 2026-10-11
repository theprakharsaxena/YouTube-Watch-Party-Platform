import { io } from 'socket.io-client';
import { SERVER_URL } from './api.js';

let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io(SERVER_URL || undefined, {
      autoConnect: false,
      auth: (cb) => {
        try {
          const token = localStorage.getItem('watchalong_auth_token') || localStorage.getItem('sidelight_auth_token');
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

const key = (roomId) => `watchalong:session:${roomId}`;
const legacyKey = (roomId) => `sidelight:session:${roomId}`;

export function loadSession(roomId) {
  try {
    return JSON.parse(
      sessionStorage.getItem(key(roomId)) || sessionStorage.getItem(legacyKey(roomId)) || 'null',
    );
  } catch {
    return null;
  }
}

export function saveSession(roomId, session) {
  try {
    sessionStorage.setItem(key(roomId), JSON.stringify(session));
  } catch {

  }
}

export function clearSession(roomId) {
  try {
    sessionStorage.removeItem(key(roomId));
    sessionStorage.removeItem(legacyKey(roomId));
  } catch {

  }
}

