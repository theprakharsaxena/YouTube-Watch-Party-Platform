import { identityFor, roomChannel } from '../socketServer.js';
import { assertPayloadObject } from '../../rooms/roomValidation.js';

const publicActor = ({ id, name, role }) => ({ id, name, role });

export function registerPlaybackHandlers(ctx, socket, on) {
  const { io, roomService } = ctx;

  // The sender is included in the broadcast on purpose: every client, including the
  // one that issued the command, applies the same authoritative snapshot.
  const broadcast = (result) => {
    io.to(roomChannel(result.room.id)).emit('playback_updated', {
      state: roomService.snapshot(result.room),
      action: result.action,
      by: publicActor(result.actor),
    });
  };

  on('playback_command', (payload) => {
    assertPayloadObject(payload);
    broadcast(roomService.applyPlaybackCommand(identityFor(ctx, socket), payload));
  });

  on('change_video', (payload) => {
    assertPayloadObject(payload);
    broadcast(roomService.changeVideo(identityFor(ctx, socket), payload.videoUrl));
  });
}
