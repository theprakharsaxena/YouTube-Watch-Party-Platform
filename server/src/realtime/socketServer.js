import { Server } from 'socket.io';
import { createRateLimiter } from '../utils/rateLimiter.js';
import { AppError, ErrorCodes, toClientError } from '../utils/errors.js';
import { registerRoomHandlers } from './handlers/roomHandlers.js';
import { registerPlaybackHandlers } from './handlers/playbackHandlers.js';
import { registerRoleHandlers } from './handlers/roleHandlers.js';
import { registerChatHandlers } from './handlers/ChatMessageHandler.js';
import { setupRedisAdapter } from './redisAdapter.js';

export const roomChannel = (roomId) => `room:${roomId}`;

export function createSocketServer(httpServer, { roomService, config, authService = null }) {
  const io = new Server(httpServer, {
    cors: { origin: config.clientOrigins, methods: ['GET', 'POST'] },
    maxHttpBufferSize: 1e5,
  });
  const sessions = new Map();

  const context = { io, roomService, sessions, config };

  setupRedisAdapter(io, { redisUrl: config.redisUrl || process.env.REDIS_URL });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    const user = authService?.verifyToken(typeof token === 'string' ? token : null) ?? null;
    if (user) {
      socket.data.user = user;
      return next();
    }
    if (config.auth?.required) {
      const error = new Error(ErrorCodes.UNAUTHORIZED);
      error.data = { code: ErrorCodes.UNAUTHORIZED, message: 'Sign in to continue.' };
      return next(error);
    }
    return next();
  });

  io.on('connection', (socket) => {
    const allow = createRateLimiter(config.rateLimit);

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
    registerChatHandlers(context, socket, on);
  });

  roomService.on('participant_status', ({ roomId }) => {
    const room = roomService.store.get(roomId);
    if (room) io.to(roomChannel(roomId)).emit('room_state', { state: roomService.snapshot(room) });
  });

  roomService.on('participant_left', ({ roomId, participant, reason, newHostId }) => {
    const room = roomService.store.get(roomId);
    if (!room) return;

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

export function detachSocket({ io, sessions }, socketId) {
  const session = sessions.get(socketId);
  sessions.delete(socketId);
  const socket = io.sockets.sockets.get(socketId);
  if (session && socket) socket.leave(roomChannel(session.roomId));
  return session;
}

export function identityFor({ sessions }, socket) {
  const session = sessions.get(socket.id);
  if (!session) throw new AppError(ErrorCodes.NOT_IN_ROOM, 'Join a room first.');
  return { ...session, socketId: socket.id };
}

