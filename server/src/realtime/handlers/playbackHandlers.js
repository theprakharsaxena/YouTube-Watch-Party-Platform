import { BaseMessageHandler } from './BaseMessageHandler.js';
import { assertPayloadObject } from '../../rooms/roomValidation.js';

const publicActor = ({ id, name, role }) => ({ id, name, role });

export class PlaybackMessageHandler extends BaseMessageHandler {
  broadcast(result) {
    this.broadcastToRoom(result.room.id, 'playback_updated', {
      state: this.roomService.snapshot(result.room),
      action: result.action,
      by: publicActor(result.actor),
    });
  }

  register() {
    this.on('playback_command', (payload) => {
      assertPayloadObject(payload);
      const identity = this.identity();
      const result = this.roomService.applyPlaybackCommand(identity, payload);
      this.broadcast(result);
    });

    this.on('change_video', (payload) => {
      assertPayloadObject(payload);
      const identity = this.identity();
      const result = this.roomService.changeVideo(identity, payload.videoUrl);
      this.broadcast(result);
    });
  }
}

export function registerPlaybackHandlers(ctx, socket, on) {
  new PlaybackMessageHandler(ctx, socket, on).register();
}

