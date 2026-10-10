import { Server } from 'socket.io';
import { createRateLimiter } from '../utils/rateLimiter.js';
import { AppError, ErrorCodes, toClientError } from '../utils/errors.js';
import { registerRoomHandlers } from './handlers/roomHandlers.js';
import { registerPlaybackHandlers } from './handlers/playbackHandlers.js';
import { registerRoleHandlers } from './handlers/roleHandlers.js';

export const roomChannel = (roomId) => `room:${roomId}`;

/**
 * Wires Socket.IO to the RoomService.
 *
 * `sessions` maps socket.id -> { roomId, participantId }. It is the server-side
 * association used to identify who is acting: handlers NEVER read a participant
 * id or role from the event payload to decide who the caller is.
 */
export function createSocketServer(httpServer, { roomService, config }) {
  const io = new Server(httpServer, {
    cors: { origin: config.clientOrigins, methods: ['GET', 'POST'] },
    maxHttpBufferSize: 1e5, // 100 KB is plenty for our tiny payloads
  });
  const sessions = new Map();

  const context = { io, roomService, sessions, config };

  io.on('connection', (socket) => {
    const allow = createRateLimiter(config.rateLimit);

    /**
     * Wrap a handler: rate limit, payload sanity, and uniform error reporting.
     * Handlers throw AppError; anything else is logged and masked.
     */
    const on = (event, handler) => {
      socket.on(event, (payload) => {
        try {
          if (!allow()) throw new AppError(ErrorCodes.RATE_LIMITED, 'Slow down a little.');
          handler(payload ?? {});
        } catch (error) {
          if (!(error instanceof AppError)) console.error(`[socket] ${event} failed:`, error);
          socket.emit('room_error', toClientError(error, event));
        }
      });
    };

    registerRoomHandlers(context, socket, on);
    registerPlaybackHandlers(context, socket, on);
    registerRoleHandlers(context, socket, on);
  });

  // Timer-driven changes originate in the service rather than a socket event.
  roomService.on('participant_status', ({ roomId }) => {
    const room = roomService.store.get(roomId);
    if (room) io.to(roomChannel(roomId)).emit('room_state', { state: roomService.snapshot(room) });
  });

  roomService.on('participant_left', ({ roomId, participant, reason, newHostId }) => {
    const room = roomService.store.get(roomId);
    if (!room) return;
    // A voluntary leave already detached the socket; a timeout has no socket.
    io.to(roomChannel(roomId)).emit('participant_left', {
      state: roomService.snapshot(room),
      participantId: participant.id,
      name: participant.name,
      reason,
      newHostId,
    });
  });

  return io;
}

/** Remove a socket's room binding (both Socket.IO room and our session map). */
export function detachSocket({ io, sessions }, socketId) {
  const session = sessions.get(socketId);
  sessions.delete(socketId);
  const socket = io.sockets.sockets.get(socketId);
  if (session && socket) socket.leave(roomChannel(session.roomId));
  return session;
}

/** Resolve the caller's identity strictly from server-side state. */
export function identityFor({ sessions }, socket) {
  const session = sessions.get(socket.id);
  if (!session) throw new AppError(ErrorCodes.NOT_IN_ROOM, 'Join a room first.');
  return { ...session, socketId: socket.id };
}
