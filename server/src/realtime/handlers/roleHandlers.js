import { BaseMessageHandler } from './BaseMessageHandler.js';
import { detachSocket } from '../socketServer.js';
import { assertPayloadObject, parseId } from '../../rooms/roomValidation.js';

export class RoleMessageHandler extends BaseMessageHandler {
  register() {
    this.on('assign_role', (payload) => {
      assertPayloadObject(payload);
      const targetId = parseId(payload.targetId);
      const { room, actor, target, role, hostTransferred } = this.roomService.assignRole(
        this.identity(),
        targetId,
        payload.role,
      );
      this.broadcastToRoom(room.id, 'role_updated', {
        state: this.roomService.snapshot(room),
        targetId: target.id,
        targetName: target.name,
        role,
        hostTransferred,
        by: { id: actor.id, name: actor.name },
      });
    });

    this.on('remove_participant', (payload) => {
      assertPayloadObject(payload);
      const targetId = parseId(payload.targetId);
      const { room, actor, target } = this.roomService.removeParticipant(this.identity(), targetId);

      const targetSocketId = target.socketId;
      if (targetSocketId) {
        this.io.sockets.sockets.get(targetSocketId)?.emit('participant_removed', {
          removed: true,
          roomId: room.id,
          message: 'The host removed you from this room.',
        });
        detachSocket(this.ctx, targetSocketId);
      }

      this.broadcastToRoom(room.id, 'participant_removed', {
        state: this.roomService.snapshot(room),
        participantId: target.id,
        name: target.name,
        by: { id: actor.id, name: actor.name },
      });
    });
  }
}

export function registerRoleHandlers(ctx, socket, on) {
  new RoleMessageHandler(ctx, socket, on).register();
}

