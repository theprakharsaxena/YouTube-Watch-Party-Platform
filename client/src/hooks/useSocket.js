import { useCallback, useEffect, useState } from 'react';
import { getSocket } from '../services/socket.js';

const CONNECT_TIMEOUT_MS = 10000;

export function useSocket() {
  const socket = getSocket();
  const [status, setStatus] = useState(socket.connected ? 'connected' : 'disconnected');

  useEffect(() => {
    const onConnect = () => setStatus('connected');
    const onDisconnect = (reason) => setStatus(reason === 'io client disconnect' ? 'disconnected' : 'reconnecting');
    const onAttempt = () => setStatus((current) => (current === 'connecting' ? current : 'reconnecting'));
    const onConnectError = () => setStatus('disconnected');
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.io.on('reconnect_attempt', onAttempt);
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
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
          reject({ code: 'NETWORK', message: 'Could not reach the WatchAlong server. Check your connection and try again.' });
        };
        const timer = setTimeout(fail, CONNECT_TIMEOUT_MS);
        const succeed = () => {
          cleanup();
          resolve();
        };
        const onConnectError = (err) => {
          cleanup();
          const errData = err?.data;
          const code = errData?.code || (err?.message === 'UNAUTHORIZED' ? 'UNAUTHORIZED' : 'CONNECT_ERROR');
          const message =
            errData?.message ||
            (err?.message === 'UNAUTHORIZED'
              ? 'Please log in to continue.'
              : err?.message || 'Could not reach the WatchAlong server. Check your connection and try again.');
          reject({ code, message });
        };
        function cleanup() {
          clearTimeout(timer);
          socket.off('connect', succeed);
          socket.off('connect_error', onConnectError);
        }
        socket.on('connect', succeed);
        socket.on('connect_error', onConnectError);
        if (!socket.active || !socket.connected) {
          setStatus('connecting');
          socket.connect();
        }
      }),
    [socket],
  );

  return { socket, status, ensureConnected };
}

