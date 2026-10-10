import { Roles } from '../auth/permissions.js';
import { newParticipantId, newReconnectToken } from '../auth/sessionIdentity.js';

/**
 * Encapsulates participant entity, credentials, and state.
 */
export class Participant {
  constructor({
    id = newParticipantId(),
    name,
    role = Roles.PARTICIPANT,
    socketId = null,
    token = newReconnectToken(),
    connected = true,
    joinedAt = Date.now(),
    userId = null,
  }) {
    this.id = id;
    this.userId = userId; // authenticated account that owns this seat (null when auth is disabled)
    this.name = name;
    this.role = role;
    this.socketId = socketId;
    this.token = token;
    this.connected = connected;
    this.joinedAt = joinedAt;
    this.updatedAt = joinedAt;
  }

  setRole(newRole) {
    this.role = newRole;
    this.updatedAt = Date.now();
  }

  setConnected(status, socketId = null) {
    this.connected = status;
    if (socketId !== null) {
      this.socketId = socketId;
    }
    this.updatedAt = Date.now();
  }

  /** Public snapshot safe to broadcast to any peer in the room. Never leaks tokens or socket IDs. */
  toPublic() {
    return {
      id: this.id,
      name: this.name,
      role: this.role,
      connected: this.connected,
      joinedAt: this.joinedAt,
    };
  }

  /** Full object sent only to the seat owner upon join or restore. */
  toPrivate() {
    return {
      id: this.id,
      name: this.name,
      role: this.role,
      token: this.token,
      connected: this.connected,
      joinedAt: this.joinedAt,
    };
  }

  /** Serialized for persistent storage. */
  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      name: this.name,
      role: this.role,
      socketId: null, // Sockets are ephemeral across restarts
      token: this.token,
      connected: false, // Start as disconnected on restore
      joinedAt: this.joinedAt,
      updatedAt: this.updatedAt,
    };
  }

  static fromJSON(data) {
    return new Participant({
      id: data.id,
      userId: data.userId ?? null,
      name: data.name,
      role: data.role,
      socketId: null,
      token: data.token,
      connected: false,
      joinedAt: data.joinedAt,
    });
  }
}
