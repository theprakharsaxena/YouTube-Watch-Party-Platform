import { detachSocket, identityFor, roomChannel } from '../socketServer.js';
import { assertPayloadObject, parseId } from '../../rooms/roomValidation.js';

export function registerRoleHandlers(ctx, socket, on) {
  const { io, roomService } = ctx;

  on('assign_role', (payload) => {
    assertPayloadObject(payload);
    const targetId = parseId(payload.targetId);
    const { room, actor, target, role, hostTransferred } = roomService.assignRole(
      identityFor(ctx, socket),
      targetId,
      payload.role,
    );
    io.to(roomChannel(room.id)).emit('role_updated', {
      state: roomService.snapshot(room),
      targetId: target.id,
      targetName: target.name,
      role,
      hostTransferred,
      by: { id: actor.id, name: actor.name },
    });
  });

  on('remove_participant', (payload) => {
    assertPayloadObject(payload);
    const targetId = parseId(payload.targetId);
    const { room, actor, target } = roomService.removeParticipant(identityFor(ctx, socket), targetId);

    // Tell the removed socket, then detach it so it cannot receive or send for this room.
    const targetSocketId = target.socketId;
    if (targetSocketId) {
      io.sockets.sockets.get(targetSocketId)?.emit('participant_removed', {
        removed: true,
        roomId: room.id,
        message: 'The host removed you from this room.',
      });
      detachSocket(ctx, targetSocketId);
    }
    io.to(roomChannel(room.id)).emit('participant_removed', {
      state: roomService.snapshot(room),
      participantId: target.id,
      name: target.name,
      by: { id: actor.id, name: actor.name },
    });
  });
}
