import { detachSocket, identityFor, roomChannel } from '../socketServer.js';

/**
 * Base class for all WebSocket message handlers.
 * Encapsulates socket context, identity extraction, and broadcasting utilities.
 */
export class BaseMessageHandler {
  constructor(ctx, socket, on) {
    this.ctx = ctx;
    this.socket = socket;
    this.on = on;
    this.io = ctx.io;
    this.roomService = ctx.roomService;
    this.sessions = ctx.sessions;
    this.config = ctx.config;
  }

  /**
   * Resolves the calling participant identity securely from server-side session.
   * Never trusts client-supplied identity parameters.
   */
  identity() {
    return identityFor(this.ctx, this.socket);
  }

  /**
   * Channel name for room broadcast.
   */
  channel(roomId) {
    return roomChannel(roomId);
  }

  /**
   * Broadcast an event to all participants in a room.
   */
  broadcastToRoom(roomId, event, payload) {
    this.io.to(this.channel(roomId)).emit(event, payload);
  }

  /**
   * Broadcast to all participants in a room EXCEPT the current socket.
   */
  broadcastToPeers(roomId, event, payload) {
    this.socket.to(this.channel(roomId)).emit(event, payload);
  }

  /**
   * Emit an event only to the current socket.
   */
  emit(event, payload) {
    this.socket.emit(event, payload);
  }

  /**
   * Subclasses must override to register their event listeners.
   */
  register() {
    throw new Error('MessageHandler subclass must implement register()');
  }
}
