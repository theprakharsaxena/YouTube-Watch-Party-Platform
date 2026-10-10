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
  }
}

export function registerChatHandlers(ctx, socket, on) {
  new ChatMessageHandler(ctx, socket, on).register();
}
