import { useCallback, useEffect, useState } from 'react';
import { getSocket } from '../services/socket.js';

const CONNECT_TIMEOUT_MS = 10000;

/**
 * Tracks the shared socket's connection status and offers ensureConnected().
 * Status: connecting | connected | reconnecting | disconnected
 */
export function useSocket() {
  const socket = getSocket();
  const [status, setStatus] = useState(socket.connected ? 'connected' : 'disconnected');

  useEffect(() => {
    const onConnect = () => setStatus('connected');
    const onDisconnect = (reason) => setStatus(reason === 'io client disconnect' ? 'disconnected' : 'reconnecting');
    const onAttempt = () => setStatus((current) => (current === 'connecting' ? current : 'reconnecting'));
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.io.on('reconnect_attempt', onAttempt);
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.io.off('reconnect_attempt', onAttempt);
    };
  }, [socket]);

  const ensureConnected = useCallback(
    () =>
      new Promise((resolve, reject) => {
        if (socket.connected) {
          resolve();
          return;
        }
        const fail = () => {
          cleanup();
          reject({ code: 'NETWORK', message: 'Could not reach the Sidelight server. Check your connection and try again.' });
        };
        const timer = setTimeout(fail, CONNECT_TIMEOUT_MS);
        const succeed = () => {
          cleanup();
          resolve();
        };
        function cleanup() {
          clearTimeout(timer);
          socket.off('connect', succeed);
        }
        socket.on('connect', succeed);
        if (!socket.active) {
          setStatus('connecting');
          socket.connect();
        }
      }),
    [socket],
  );

  return { socket, status, ensureConnected };
}
