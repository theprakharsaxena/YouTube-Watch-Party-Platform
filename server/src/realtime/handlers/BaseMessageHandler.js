import { detachSocket, identityFor, roomChannel } from '../socketServer.js';

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

  identity() {
    return identityFor(this.ctx, this.socket);
  }

  channel(roomId) {
    return roomChannel(roomId);
  }

  broadcastToRoom(roomId, event, payload) {
    this.io.to(this.channel(roomId)).emit(event, payload);
  }

  broadcastToPeers(roomId, event, payload) {
    this.socket.to(this.channel(roomId)).emit(event, payload);
  }

  emit(event, payload) {
    this.socket.emit(event, payload);
  }

  register() {
    throw new Error('MessageHandler subclass must implement register()');
  }
}

