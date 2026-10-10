import { BaseMessageHandler } from './BaseMessageHandler.js';
import { assertPayloadObject } from '../../rooms/roomValidation.js';

/**
 * Handles in-room text chat and live synchronized reactions.
 */
export class ChatMessageHandler extends BaseMessageHandler {
  register() {
    this.on('chat_message', (payload) => {
      assertPayloadObject(payload);
      const identity = this.identity();
      const { room, message } = this.roomService.addChatMessage(identity, payload.text);

      this.broadcastToRoom(room.id, 'chat_message', { message });
    });

    this.on('send_reaction', (payload) => {
      assertPayloadObject(payload);
      const identity = this.identity();
      const { room, reaction } = this.roomService.recordReaction(identity, payload.emoji);

      this.broadcastToRoom(room.id, 'reaction_broadcast', { reaction });
    });

    this.on('request_change', (payload) => {
      assertPayloadObject(payload);
      const identity = this.identity();
      const { room, actor, request } = this.roomService.requestChange(identity, payload);

      this.broadcastToRoom(room.id, 'change_requested', {
        state: this.roomService.snapshot(room),
        request,
        by: { id: actor.id, name: actor.name, role: actor.role },
      });
    });

    this.on('respond_change_request', (payload) => {
      assertPayloadObject(payload);
      const identity = this.identity();
      const { room, actor, request, approved, actionResult } = this.roomService.respondChangeRequest(identity, payload);

      if (approved && actionResult) {
        this.broadcastToRoom(room.id, 'playback_updated', {
          state: this.roomService.snapshot(room),
          action: actionResult.action,
          by: { id: actor.id, name: actor.name, role: actor.role },
        });
      }

      this.broadcastToRoom(room.id, 'change_request_resolved', {
        state: this.roomService.snapshot(room),
        requestId: request.id,
        approved,
        request,
        by: { id: actor.id, name: actor.name, role: actor.role },
      });
    });
  }
}

export function registerChatHandlers(ctx, socket, on) {
  new ChatMessageHandler(ctx, socket, on).register();
}
