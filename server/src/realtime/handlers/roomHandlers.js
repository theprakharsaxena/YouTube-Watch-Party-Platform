import { detachSocket, identityFor, roomChannel } from '../socketServer.js';
import { AppError, ErrorCodes } from '../../utils/errors.js';
import {
  assertPayloadObject,
  normalizeRoomId,
  parseOptionalToken,
} from '../../rooms/roomValidation.js';

export function registerRoomHandlers(ctx, socket, on) {
  const { io, roomService, sessions } = ctx;

  const bind = (room, participant) => {
    sessions.set(socket.id, { roomId: room.id, participantId: participant.id });
    socket.join(roomChannel(room.id));
  };

  // A socket holds at most one seat. Leave any previous one before taking another.
  const leaveCurrentSeat = () => {
    const session = sessions.get(socket.id);
    if (!session) return;
    detachSocket(ctx, socket.id);
    try {
      roomService.leaveRoom({ ...session, socketId: socket.id });
    } catch {
      /* seat already gone */
    }
  };

  on('create_room', (payload) => {
    assertPayloadObject(payload);
    leaveCurrentSeat();
    const { room, participant } = roomService.createRoom({
      displayName: payload.displayName,
      videoInput: payload.videoUrl,
      socketId: socket.id,
    });
    bind(room, participant);
    socket.emit('room_created', {
      roomId: room.id,
      participantId: participant.id,
      token: participant.token,
      state: roomService.snapshot(room),
    });
  });

  on('join_room', (payload) => {
    assertPayloadObject(payload);
    const roomId = normalizeRoomId(payload.roomId);
    const token = parseOptionalToken(payload.token);

    // Repeated join for the seat this socket already holds: just resend state.
    const current = sessions.get(socket.id);
    if (current?.roomId === roomId) {
      const { room, participant } = roomService.requireMember({ ...current, socketId: socket.id });
      socket.emit('room_joined', {
        roomId,
        participantId: participant.id,
        token: participant.token,
        rejoined: true,
        state: roomService.snapshot(room),
      });
      return;
    }
    if (current) leaveCurrentSeat();

    const { room, participant, rejoined, displacedSocketId } = roomService.joinRoom({
      roomId,
      displayName: payload.displayName,
      token,
      socketId: socket.id,
    });

    // The same seat opened in another tab: the old socket is no longer authoritative.
    if (displacedSocketId) {
      const old = io.sockets.sockets.get(displacedSocketId);
      detachSocket(ctx, displacedSocketId);
      old?.emit('room_error', {
        code: ErrorCodes.SESSION_REPLACED,
        message: 'You joined this room from another tab, so this one was disconnected.',
        event: 'join_room',
      });
    }

    bind(room, participant);
    const state = roomService.snapshot(room);
    socket.emit('room_joined', {
      roomId,
      participantId: participant.id,
      token: participant.token,
      rejoined,
      state,
    });
    if (rejoined) {
      socket.to(roomChannel(roomId)).emit('room_state', { state });
    } else {
      socket.to(roomChannel(roomId)).emit('participant_joined', {
        state,
        participant: { id: participant.id, name: participant.name, role: participant.role },
      });
    }
  });

  on('leave_room', () => {
    const session = sessions.get(socket.id);
    if (!session) return;
    leaveCurrentSeat();
    socket.emit('room_left', { roomId: session.roomId });
  });

  on('request_sync', () => {
    const { room } = roomService.requireMember(identityFor(ctx, socket));
    socket.emit('room_state', { state: roomService.snapshot(room) });
  });

  socket.on('disconnect', () => {
    const session = detachSocket(ctx, socket.id);
    if (session) roomService.handleDisconnect({ ...session, socketId: socket.id });
  });
}

export { AppError };
