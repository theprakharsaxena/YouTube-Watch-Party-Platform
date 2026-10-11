import { BaseMessageHandler } from './BaseMessageHandler.js';
import { detachSocket } from '../socketServer.js';
import { AppError, ErrorCodes } from '../../utils/errors.js';
import {
  assertPayloadObject,
  normalizeRoomId,
  parseOptionalToken,
} from '../../rooms/roomValidation.js';

export class RoomMessageHandler extends BaseMessageHandler {
  bind(room, participant) {
    this.sessions.set(this.socket.id, { roomId: room.id, participantId: participant.id });
    this.socket.join(this.channel(room.id));
  }

  leaveCurrentSeat() {
    const session = this.sessions.get(this.socket.id);
    if (!session) return;
    detachSocket(this.ctx, this.socket.id);
    try {
      this.roomService.leaveRoom({ ...session, socketId: this.socket.id });
    } catch {

    }
  }

  register() {
    this.on('create_room', (payload) => {
      assertPayloadObject(payload);
      this.leaveCurrentSeat();
      const { room, participant } = this.roomService.createRoom({
        displayName: payload.displayName,
        videoInput: payload.videoUrl,
        socketId: this.socket.id,
        user: this.socket.data.user ?? null,
      });
      this.bind(room, participant);
      this.emit('room_created', {
        roomId: room.id,
        participantId: participant.id,
        token: participant.token,
        state: this.roomService.snapshot(room),
      });
    });

    this.on('join_room', (payload) => {
      assertPayloadObject(payload);
      const roomId = normalizeRoomId(payload.roomId);
      const token = parseOptionalToken(payload.token);

      const current = this.sessions.get(this.socket.id);
      if (current?.roomId === roomId) {
        const { room, participant } = this.roomService.requireMember({ ...current, socketId: this.socket.id });
        this.emit('room_joined', {
          roomId,
          participantId: participant.id,
          token: participant.token,
          rejoined: true,
          state: this.roomService.snapshot(room),
        });
        return;
      }
      if (current) this.leaveCurrentSeat();

      const { room, participant, rejoined, displacedSocketId } = this.roomService.joinRoom({
        roomId,
        displayName: payload.displayName,
        token,
        socketId: this.socket.id,
        user: this.socket.data.user ?? null,
      });

      if (displacedSocketId) {
        const old = this.io.sockets.sockets.get(displacedSocketId);
        detachSocket(this.ctx, displacedSocketId);
        old?.emit('room_error', {
          code: ErrorCodes.SESSION_REPLACED,
          message: 'You joined this room from another tab, so this one was disconnected.',
          event: 'join_room',
        });
      }

      this.bind(room, participant);
      const state = this.roomService.snapshot(room);
      this.emit('room_joined', {
        roomId,
        participantId: participant.id,
        token: participant.token,
        rejoined,
        state,
      });
      if (rejoined) {
        this.broadcastToPeers(roomId, 'room_state', { state });
      } else {
        this.broadcastToPeers(roomId, 'participant_joined', {
          state,
          participant: { id: participant.id, name: participant.name, role: participant.role },
        });
      }
    });

    this.on('leave_room', () => {
      const session = this.sessions.get(this.socket.id);
      if (!session) return;
      this.leaveCurrentSeat();
      this.emit('room_left', { roomId: session.roomId });
    });

    this.on('request_sync', () => {
      const { room } = this.roomService.requireMember(this.identity());
      this.emit('room_state', { state: this.roomService.snapshot(room) });
    });

    this.socket.on('disconnect', () => {
      const session = detachSocket(this.ctx, this.socket.id);
      if (session) this.roomService.handleDisconnect({ ...session, socketId: this.socket.id });
    });
  }
}

export function registerRoomHandlers(ctx, socket, on) {
  new RoomMessageHandler(ctx, socket, on).register();
}

export { AppError };

