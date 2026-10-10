import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useSocket } from './useSocket.js';
import { useToast } from '../components/Toast.jsx';
import { clearSession, loadSession, saveSession } from '../services/socket.js';
import { ROLE_LABELS } from '../utils/formatters.js';

const RoomContext = createContext(null);

const EMPTY = { phase: 'idle', roomId: null, me: null, state: null, receivedAt: 0, endedReason: null };
const REQUEST_TIMEOUT_MS = 8000;

export function RoomProvider({ children }) {
  const toast = useToast();
  const { socket, status, ensureConnected } = useSocket();
  const [room, setRoom] = useState(EMPTY);
  const [chatMessages, setChatMessages] = useState([]);
  const [reactions, setReactions] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const roomRef = useRef(room); // always-fresh mirror for socket callbacks (avoids stale closures)
  const waiters = useRef(new Set());

  const update = useCallback((patch) => {
    roomRef.current = { ...roomRef.current, ...(typeof patch === 'function' ? patch(roomRef.current) : patch) };
    setRoom(roomRef.current);
  }, []);

  // Request/response over events: resolve on a success event, reject on a matching room_error.
  const emitAndWait = useCallback(
    (event, payload, successEvents) =>
      new Promise((resolve, reject) => {
        if (!socket.connected) {
          reject({ code: 'NETWORK', message: 'You are offline. Reconnecting…' });
          return;
        }
        const waiter = {
          event,
          successEvents,
          resolve,
          reject,
          timer: setTimeout(() => {
            waiters.current.delete(waiter);
            reject({ code: 'TIMEOUT', message: 'The server took too long to respond.' });
          }, REQUEST_TIMEOUT_MS),
        };
        waiters.current.add(waiter);
        socket.emit(event, payload);
      }),
    [socket],
  );

  useEffect(() => {
    const settle = (eventName, data) => {
      for (const waiter of [...waiters.current]) {
        if (waiter.successEvents.includes(eventName)) {
          clearTimeout(waiter.timer);
          waiters.current.delete(waiter);
          waiter.resolve(data);
        }
      }
    };
    const settleError = (error) => {
      let handled = false;
      for (const waiter of [...waiters.current]) {
        if (waiter.event === error.event) {
          clearTimeout(waiter.timer);
          waiters.current.delete(waiter);
          waiter.reject(error);
          handled = true;
        }
      }
      return handled;
    };

    const applyState = (state) => {
      if (state.chat && Array.isArray(state.chat)) {
        setChatMessages(state.chat);
      }
      if (state.pendingRequests && Array.isArray(state.pendingRequests)) {
        setPendingRequests(state.pendingRequests);
      }
      update({ state, receivedAt: Date.now() });
    };
    const myId = () => roomRef.current.me?.participantId;
    const nameOf = (state, id) => state.participants.find((p) => p.id === id)?.name ?? 'Someone';

    const onEntered = (eventName) => (data) => {
      const previous = loadSession(data.roomId);
      const name = data.state.participants.find((p) => p.id === data.participantId)?.name ?? previous?.name;
      saveSession(data.roomId, { participantId: data.participantId, token: data.token, name });
      if (data.state.chat && Array.isArray(data.state.chat)) {
        setChatMessages(data.state.chat);
      }
      if (data.state.pendingRequests && Array.isArray(data.state.pendingRequests)) {
        setPendingRequests(data.state.pendingRequests);
      }
      update({
        phase: 'joined',
        roomId: data.roomId,
        me: { participantId: data.participantId, token: data.token, name },
        state: data.state,
        receivedAt: Date.now(),
        endedReason: null,
      });
      settle(eventName, data);
    };

    const handlers = {
      room_created: onEntered('room_created'),
      room_joined: onEntered('room_joined'),
      room_state: ({ state }) => applyState(state),
      chat_message: ({ message }) => {
        setChatMessages((prev) => [...prev, message]);
      },
      reaction_broadcast: ({ reaction }) => {
        const item = {
          ...reaction,
          key: `${reaction.id || 'r'}-${Date.now()}-${Math.random()}`,
          left: 15 + Math.random() * 70, // percentage horizontal placement
        };
        setReactions((prev) => [...prev.slice(-25), item]);
        setTimeout(() => {
          setReactions((prev) => prev.filter((r) => r.key !== item.key));
        }, 2600);
      },
      change_requested: ({ state, request, by }) => {
        applyState(state);
        setPendingRequests((prev) => [...prev.filter((r) => r.id !== request.id), request]);
        const currentMyId = myId();
        // Do not notify the requester (they already saw the submission confirmation toast)
        if (by?.id === currentMyId) return;

        // Only display to hosts and moderators who can act on the request
        const myRole = state.participants?.find((p) => p.id === currentMyId)?.role;
        if (myRole === 'host' || myRole === 'moderator') {
          toast.info(`${by.name} requested to change the video.`);
        }
      },
      change_request_resolved: ({ state, requestId, approved, resolvedBy, by, request }) => {
        applyState(state);
        setPendingRequests((prev) => prev.filter((r) => r.id !== requestId));
        const resolver = resolvedBy || by;
        const currentMyId = myId();

        // If I was the host/moderator who approved or declined the request, don't toast myself
        if (resolver?.id === currentMyId) return;

        if (approved) {
          toast.success(`${resolver?.name || 'The host'} approved the video change request.`);
        } else {
          const isRequester = request?.requesterId === currentMyId;
          toast.info(isRequester ? 'Your video change request was declined.' : 'The video change request was declined.');
        }
      },
      participant_joined: ({ state, participant }) => {
        applyState(state);
        toast.info(`${participant.name} joined the room.`);
      },
      participant_left: ({ state, name, reason, newHostId }) => {
        applyState(state);
        toast.info(reason === 'timeout' ? `${name} lost connection and was removed.` : `${name} left the room.`);
        if (newHostId) {
          toast.info(newHostId === myId() ? 'You are now the host.' : `${nameOf(state, newHostId)} is now the host.`);
        }
      },
      role_updated: ({ state, targetId, targetName, role, hostTransferred }) => {
        applyState(state);
        if (targetId === myId()) {
          toast.success(hostTransferred ? 'You are now the host.' : `You are now a ${ROLE_LABELS[role].toLowerCase()}.`);
        } else {
          toast.info(`${targetName} is now ${hostTransferred ? 'the host' : `a ${ROLE_LABELS[role].toLowerCase()}`}.`);
        }
        settle('role_updated');
      },
      participant_removed: (data) => {
        if (data.removed) {
          clearSession(roomRef.current.roomId);
          update({ phase: 'ended', endedReason: 'removed', state: null, me: null });
          return;
        }
        applyState(data.state);
        toast.info(`${data.name} was removed from the room.`);
        settle('participant_removed');
      },
      playback_updated: (data) => {
        applyState(data.state);
        if (data.action?.type === 'change_video' && data.by?.id !== myId() && !data.isRequestApproval) {
          toast.info(`${data.by.name} changed the video.`);
        }
        settle('playback_updated');
      },
      room_left: () => {},
      room_error: (error) => {
        if (settleError(error)) return;
        const current = roomRef.current;
        if (error.code === 'REMOVED_FROM_ROOM') {
          clearSession(current.roomId);
          update({ phase: 'ended', endedReason: 'removed', state: null, me: null });
        } else if (error.code === 'SESSION_REPLACED') {
          update({ phase: 'ended', endedReason: 'replaced', state: null, me: null });
        } else if (error.code === 'ROOM_NOT_FOUND' && current.phase !== 'idle') {
          clearSession(current.roomId);
          update({ phase: 'ended', endedReason: 'closed', state: null, me: null });
        } else {
          toast.error(error.message);
        }
      },
      // After any reconnect, silently reclaim our seat with the server-issued token.
      connect: () => {
        const { phase, roomId, me } = roomRef.current;
        if (phase === 'joined' && roomId && me) {
          socket.emit('join_room', { roomId, token: me.token, displayName: me.name || 'Guest' });
        }
      },
    };

    for (const [event, handler] of Object.entries(handlers)) socket.on(event, handler);
    return () => {
      for (const [event, handler] of Object.entries(handlers)) socket.off(event, handler);
    };
  }, [socket, toast, update]);

  // ----- Actions -----

  const createRoom = useCallback(
    async ({ displayName, videoUrl }) => {
      await ensureConnected();
      return emitAndWait('create_room', { displayName, videoUrl: videoUrl || undefined }, ['room_created']);
    },
    [ensureConnected, emitAndWait],
  );

  const joinRoom = useCallback(
    async ({ roomId, displayName }) => {
      const current = roomRef.current;
      if (current.phase === 'joined' && current.roomId === roomId) return current;
      await ensureConnected();
      const saved = loadSession(roomId);
      update({ phase: 'joining', roomId, endedReason: null });
      try {
        return await emitAndWait(
          'join_room',
          { roomId, displayName: displayName || saved?.name || '', token: saved?.token },
          ['room_joined'],
        );
      } catch (error) {
        update({ phase: 'idle', roomId: null });
        throw error;
      }
    },
    [ensureConnected, emitAndWait, update],
  );

  const leaveRoom = useCallback(() => {
    const { roomId } = roomRef.current;
    if (socket.connected) socket.emit('leave_room');
    if (roomId) clearSession(roomId);
    setChatMessages([]);
    setReactions([]);
    setPendingRequests([]);
    update(EMPTY);
  }, [socket, update]);

  const resetRoom = useCallback(() => {
    setChatMessages([]);
    setReactions([]);
    setPendingRequests([]);
    update(EMPTY);
  }, [update]);

  const sendPlayback = useCallback(
    (type, position) => {
      if (!socket.connected) {
        toast.error('You are offline. Reconnecting…');
        return;
      }
      socket.emit('playback_command', position === undefined ? { type } : { type, position });
    },
    [socket, toast],
  );

  const changeVideo = useCallback((videoUrl) => emitAndWait('change_video', { videoUrl }, ['playback_updated']), [emitAndWait]);
  const assignRole = useCallback((targetId, role) => emitAndWait('assign_role', { targetId, role }, ['role_updated']), [emitAndWait]);
  const removeParticipant = useCallback(
    (targetId) => emitAndWait('remove_participant', { targetId }, ['participant_removed']),
    [emitAndWait],
  );

  const sendChatMessage = useCallback(
    (text) => {
      const myRole = roomRef.current.state?.participants?.find((p) => p.id === roomRef.current.me?.participantId)?.role;
      if (myRole === 'viewer') {
        toast.info('Log in to participate in the chat.');
        return;
      }
      if (!socket.connected) {
        toast.error('You are offline.');
        return;
      }
      const trimmed = (text || '').trim();
      if (!trimmed) return;
      socket.emit('chat_message', { text: trimmed });
    },
    [socket, toast],
  );

  const sendReaction = useCallback(
    (emoji) => {
      const myRole = roomRef.current.state?.participants?.find((p) => p.id === roomRef.current.me?.participantId)?.role;
      if (myRole === 'viewer') {
        toast.info('Log in to send reactions.');
        return;
      }
      if (!socket.connected) return;
      socket.emit('send_reaction', { emoji });
    },
    [socket, toast],
  );

  const requestChange = useCallback(
    (type, payload) => {
      if (!socket.connected) {
        toast.error('You are offline.');
        return;
      }
      socket.emit('request_change', { type, payload });
      toast.info('Request submitted for approval by host & moderators.');
    },
    [socket, toast],
  );

  const respondChangeRequest = useCallback(
    (requestId, approved) => {
      if (!socket.connected) {
        toast.error('You are offline.');
        return;
      }
      socket.emit('respond_change_request', { requestId, approved });
    },
    [socket, toast],
  );

  const value = useMemo(() => {
    const participants = room.state?.participants ?? [];
    const meParticipant = participants.find((p) => p.id === room.me?.participantId) ?? null;
    const role = meParticipant?.role ?? null;
    return {
      ...room,
      connection: status,
      participants,
      meParticipant,
      role,
      isHost: role === 'host',
      canControl: role === 'host' || role === 'moderator', // UI hint only; the server enforces it
      host: participants.find((p) => p.id === room.state?.hostId) ?? null,
      chatMessages,
      reactions,
      pendingRequests,
      sendChatMessage,
      sendReaction,
      requestChange,
      respondChangeRequest,
      createRoom,
      joinRoom,
      leaveRoom,
      resetRoom,
      sendPlayback,
      changeVideo,
      assignRole,
      removeParticipant,
    };
  }, [room, status, chatMessages, reactions, pendingRequests, sendChatMessage, sendReaction, requestChange, respondChangeRequest, createRoom, joinRoom, leaveRoom, resetRoom, sendPlayback, changeVideo, assignRole, removeParticipant]);

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
}

export function useRoom() {
  const context = useContext(RoomContext);
  if (!context) throw new Error('useRoom must be used inside <RoomProvider>');
  return context;
}
