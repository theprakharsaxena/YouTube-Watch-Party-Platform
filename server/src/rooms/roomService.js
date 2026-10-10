import { EventEmitter } from 'node:events';
import { loadConfig } from '../config/index.js';
import { Actions, Roles, assertCan } from '../auth/permissions.js';
import { newParticipantId, newReconnectToken, tokensMatch } from '../auth/sessionIdentity.js';
import { AppError, ErrorCodes } from '../utils/errors.js';
import { RoomStore } from './roomManager.js';
import { Room } from './Room.js';
import { Participant } from './Participant.js';
import {
  parseAssignableRole,
  parseOptionalVideo,
  parsePosition,
  parseRequiredVideo,
  sanitizeDisplayName,
} from './roomValidation.js';

/**
 * Pure-ish room business logic. No Socket.IO in here: every method takes the
 * verified identity ({ roomId, participantId, socketId }) the socket layer resolved,
 * re-checks it against room state, and returns data for the caller to broadcast.
 *
 * Timer-driven changes (reconnect-grace expiry) are announced via EventEmitter:
 *   'participant_left'   { roomId, participant, reason, newHostId }
 *   'room_closed'        { roomId }
 *   'participant_status' { roomId, participantId, connected }
 */
export class RoomService extends EventEmitter {
  constructor({ config = loadConfig(), store = new RoomStore(), authService = null, now = () => Date.now() } = {}) {
    super();
    this.config = config;
    this.store = store;
    this.authService = authService;
    this.now = now;
    this.graceTimers = new Map(); // `${roomId}:${participantId}` -> Timeout
  }

  // ---------- Lifecycle ----------

  createRoom({ displayName, videoInput, socketId, user = null }) {
    if (this.config.auth?.required && this.config.auth.hostRequiresAccount && (!user || user.isGuest)) {
      throw new AppError(ErrorCodes.ACCOUNT_REQUIRED, 'Create an account or log in to host a room. Guests can join rooms.');
    }
    // With auth on, the name comes from the verified account, never from the payload.
    const name = sanitizeDisplayName(user?.displayName ?? displayName, this.config.limits.maxDisplayNameLength);
    const videoId = parseOptionalVideo(videoInput);

    const room = new Room({
      id: this.store.generateUniqueId(),
      createdAt: this.now(),
      hostId: null,
      playback: { videoId, status: 'paused', position: 0, updatedAt: this.now(), revision: 0 },
    });
    // The creator's role is assigned here, never taken from the payload.
    const host = this.#addParticipant(room, name, Roles.HOST, socketId, user?.id ?? null);
    room.hostId = host.id;
    this.store.set(room);
    return { room, participant: host };
  }

  /**
   * Join or rejoin. Returns { room, participant, rejoined, displacedSocketId }.
   * A valid reconnect token restores the *same seat* (and whatever role the room
   * state currently says that seat has). A missing/unknown token always yields a
   * fresh Participant seat.
   */
  joinRoom({ roomId, displayName, token, socketId, user = null }) {
    const room = this.#requireRoom(roomId);
    const userId = user?.id ?? null;
    const removedMsg = 'You were removed from this room by the host.';

    // A kicked account stays kicked even if it clears its reconnect token.
    if (userId && room.removedUserIds.has(userId)) {
      throw new AppError(ErrorCodes.REMOVED_FROM_ROOM, removedMsg);
    }
    if (token) {
      if ([...room.removedTokens].some((removed) => tokensMatch(removed, token))) {
        throw new AppError(ErrorCodes.REMOVED_FROM_ROOM, removedMsg);
      }
      const existing = [...room.participants.values()].find((p) => tokensMatch(p.token, token));
      // The token must belong to the same account that owns the seat.
      if (existing && (!userId || !existing.userId || existing.userId === userId)) {
        return this.#reattach(room, existing, socketId);
      }
    }
    // Same account, same seat: works across devices/browsers without a token.
    if (userId) {
      const owned = [...room.participants.values()].find((p) => p.userId === userId);
      if (owned) return this.#reattach(room, owned, socketId);
    }

    // Same live socket asking twice must not create a second seat.
    const sameSocket = [...room.participants.values()].find((p) => p.socketId === socketId);
    if (sameSocket) return { room, participant: sameSocket, rejoined: true, displacedSocketId: null };

    if (room.participants.size >= this.config.limits.maxParticipantsPerRoom) {
      throw new AppError(ErrorCodes.ROOM_FULL, 'This room is full.');
    }

    const isRegistered = Boolean(user && !user.isGuest);

    // Prevent unauthenticated guests from claiming registered display names:
    if (!isRegistered && displayName && (this.authService?.isRegisteredDisplayName?.(displayName) || this.authService?.isRegisteredUsername?.(displayName))) {
      throw new AppError(
        ErrorCodes.INVALID_NAME,
        `"${displayName}" is a registered account display name. Please log in to join as this user, or choose another name to join as Viewer.`
      );
    }

    // Role assignment:
    // Logged in users join as PARTICIPANT.
    // Unlogged-in users (guests) join as VIEWER.
    const role = (!this.config.auth?.required || isRegistered) ? Roles.PARTICIPANT : Roles.VIEWER;
    const name = sanitizeDisplayName(user?.displayName ?? displayName, this.config.limits.maxDisplayNameLength);
    const participant = this.#addParticipant(room, name, role, socketId, userId);
    return { room, participant, rejoined: false, displacedSocketId: null };
  }

  leaveRoom(identity) {
    const { room, participant } = this.requireMember(identity);
    this.#removeParticipant(room, participant, 'left');
  }

  /** Called when a socket drops. The seat is kept for a grace period. */
  handleDisconnect({ roomId, participantId, socketId }) {
    const room = this.store.get(roomId);
    const participant = room?.participants.get(participantId);
    if (!participant || participant.socketId !== socketId) return; // stale socket
    participant.socketId = null;
    participant.connected = false;
    this.emit('participant_status', { roomId, participantId, connected: false });

    const timer = setTimeout(() => {
      this.graceTimers.delete(this.#timerKey(roomId, participantId));
      const current = this.store.get(roomId)?.participants.get(participantId);
      if (current && !current.connected) this.#removeParticipant(this.store.get(roomId), current, 'timeout');
    }, this.config.limits.reconnectGraceMs);
    timer.unref?.();
    this.graceTimers.set(this.#timerKey(roomId, participantId), timer);
  }

  // ---------- Authorization gate ----------

  /**
   * Every protected operation starts here. Verifies that the claimed participant
   * exists in the claimed room AND is currently bound to this very socket.
   */
  requireMember({ roomId, participantId, socketId }) {
    const room = this.store.get(roomId);
    const participant = room?.participants.get(participantId);
    if (!room || !participant || participant.socketId !== socketId || !participant.connected) {
      throw new AppError(ErrorCodes.NOT_IN_ROOM, 'You are not an active member of this room.');
    }
    return { room, participant };
  }

  // ---------- Playback ----------

  applyPlaybackCommand(identity, command) {
    const { room, participant } = this.requireMember(identity);
    assertCan(participant, Actions.CONTROL_PLAYBACK);

    if (command === null || typeof command !== 'object') {
      throw new AppError(ErrorCodes.INVALID_PAYLOAD, 'Malformed playback command.');
    }
    const { type } = command;
    if (!['play', 'pause', 'seek'].includes(type)) {
      throw new AppError(ErrorCodes.INVALID_PAYLOAD, 'Unknown playback command.');
    }
    if (!room.playback.videoId) {
      throw new AppError(ErrorCodes.NO_VIDEO, 'Choose a video before controlling playback.');
    }

    const maxSeek = this.config.limits.maxSeekSeconds;
    const hasPosition = command.position !== undefined && command.position !== null;
    if (type === 'seek' && !hasPosition) {
      throw new AppError(ErrorCodes.INVALID_POSITION, 'A seek needs a position.');
    }
    // For play/pause the controller may report its exact position; otherwise use the server estimate.
    const position = hasPosition ? parsePosition(command.position, maxSeek) : this.currentPosition(room);

    const status = type === 'seek' ? room.playback.status : type === 'play' ? 'playing' : 'paused';
    this.#commitPlayback(room, { status, position });
    return { room, actor: participant, action: { type, position } };
  }

  changeVideo(identity, videoInput) {
    const { room, participant } = this.requireMember(identity);
    assertCan(participant, Actions.CHANGE_VIDEO);
    const videoId = parseRequiredVideo(videoInput);
    this.#commitPlayback(room, { videoId, status: 'paused', position: 0 });
    return { room, actor: participant, action: { type: 'change_video', videoId } };
  }

  /** Authoritative position "now": the last known position plus elapsed time if playing. */
  currentPosition(room) {
    const { status, position, updatedAt } = room.playback;
    if (status !== 'playing') return position;
    return position + Math.max(0, this.now() - updatedAt) / 1000;
  }

  // ---------- Roles & moderation ----------

  assignRole(identity, targetId, roleInput) {
    const { room, participant: actor } = this.requireMember(identity);
    assertCan(actor, Actions.MANAGE_ROLES); // participants/moderators stop here, incl. self-promotion
    const role = parseAssignableRole(roleInput);
    const target = this.#requireTarget(room, targetId);

    if (target.id === actor.id) {
      throw new AppError(ErrorCodes.INVALID_TARGET, 'You cannot change your own role.');
    }

    const isTargetGuest = !target.userId || target.userId.startsWith('g_');
    if (this.config.auth?.required && [Roles.HOST, Roles.MODERATOR].includes(role) && isTargetGuest) {
      throw new AppError(ErrorCodes.ACCOUNT_REQUIRED, 'Only registered accounts can be made Host or Moderator. Viewers must create an account first.');
    }

    if (role === Roles.HOST) {
      // Ownership transfer: the previous host stays on as a moderator.
      target.role = Roles.HOST;
      actor.role = Roles.MODERATOR;
      room.hostId = target.id;
      return { room, actor, target, role, hostTransferred: true };
    }
    target.role = role;
    return { room, actor, target, role, hostTransferred: false };
  }

  removeParticipant(identity, targetId) {
    const { room, participant: actor } = this.requireMember(identity);
    assertCan(actor, Actions.REMOVE_PARTICIPANT);
    const target = this.#requireTarget(room, targetId);
    if (target.id === actor.id || target.role === Roles.HOST) {
      throw new AppError(ErrorCodes.INVALID_TARGET, 'The host cannot be removed.');
    }
    room.removedTokens.add(target.token);
    if (target.userId) room.removedUserIds.add(target.userId);
    this.#clearGraceTimer(room.id, target.id);
    room.participants.delete(target.id);
    return { room, actor, target };
  }

  // ---------- Chat & Reactions ----------

  addChatMessage(identity, textInput) {
    const { room, participant: actor } = this.requireMember(identity);
    assertCan(actor, Actions.SEND_CHAT);
    const text = (textInput || '').trim();
    if (!text) {
      throw new AppError(ErrorCodes.INVALID_PAYLOAD, 'Message cannot be empty.');
    }
    if (text.length > 500) {
      throw new AppError(ErrorCodes.INVALID_PAYLOAD, 'Message cannot exceed 500 characters.');
    }
    const message = typeof room.addChatMessage === 'function'
      ? room.addChatMessage({
          senderId: actor.id,
          senderName: actor.name,
          senderRole: actor.role,
          text,
          type: 'user',
          now: this.now(),
        })
      : {
          id: `${room.id}:${this.now()}:${Math.random().toString(36).slice(2, 7)}`,
          senderId: actor.id,
          senderName: actor.name,
          senderRole: actor.role,
          text,
          type: 'user',
          timestamp: this.now(),
        };
    return { room, actor, message };
  }

  recordReaction(identity, emoji) {
    const { room, participant: actor } = this.requireMember(identity);
    assertCan(actor, Actions.SEND_REACTION);
    const ALLOWED = ['🔥', '❤️', '😂', '👏', '🍿', '🤯', '🚀', '💯', '✨', '🎉'];
    if (!ALLOWED.includes(emoji)) {
      throw new AppError(ErrorCodes.INVALID_PAYLOAD, 'Unsupported reaction emoji.');
    }
    const reaction = {
      id: `${room.id}:${this.now()}:${Math.random().toString(36).slice(2, 6)}`,
      senderId: actor.id,
      senderName: actor.name,
      emoji,
      timestamp: this.now(),
    };
    return { room, actor, reaction };
  }

  // ---------- Change Requests (Approval Workflow) ----------

  requestChange(identity, { type, payload }) {
    const { room, participant: actor } = this.requireMember(identity);
    assertCan(actor, Actions.REQUEST_CHANGE);
    if (!type || !payload) {
      throw new AppError(ErrorCodes.INVALID_PAYLOAD, 'Invalid change request.');
    }
    if (type === 'change_video') {
      const videoId = parseRequiredVideo(payload.videoUrl);
      payload = { videoUrl: payload.videoUrl, videoId };
    } else {
      throw new AppError(ErrorCodes.INVALID_PAYLOAD, 'Unsupported change request type.');
    }

    const request = typeof room.addChangeRequest === 'function'
      ? room.addChangeRequest({
          requesterId: actor.id,
          requesterName: actor.name,
          requesterRole: actor.role,
          type,
          payload,
          now: this.now(),
        })
      : {
          id: 'req_' + Math.random().toString(36).slice(2, 9),
          requesterId: actor.id,
          requesterName: actor.name,
          requesterRole: actor.role,
          type,
          payload,
          createdAt: this.now(),
        };

    return { room, actor, request };
  }

  respondChangeRequest(identity, { requestId, approved }) {
    const { room, participant: actor } = this.requireMember(identity);
    // Only host or moderator can approve/decline change requests
    assertCan(actor, Actions.CHANGE_VIDEO);

    const request = typeof room.getChangeRequest === 'function' ? room.getChangeRequest(requestId) : null;
    if (!request) {
      throw new AppError(ErrorCodes.TARGET_NOT_FOUND, 'Change request not found or already resolved.');
    }

    if (typeof room.removeChangeRequest === 'function') {
      room.removeChangeRequest(requestId);
    }

    let actionResult = null;
    if (approved) {
      if (request.type === 'change_video') {
        actionResult = this.changeVideo(identity, request.payload.videoUrl);
      }
    }

    return { room, actor, request, approved: Boolean(approved), actionResult };
  }

  // ---------- Snapshot ----------

  /** Client-safe view of a room. Never includes tokens or socket ids. */
  snapshot(room) {
    const participants = [...room.participants.values()]
      .sort((a, b) => a.joinedAt - b.joinedAt)
      .map(({ id, name, role, connected }) => ({ id, name, role, connected }));
    const host = room.participants.get(room.hostId);
    return {
      roomId: room.id,
      hostId: room.hostId,
      hostConnected: Boolean(host?.connected),
      participants,
      playback: {
        videoId: room.playback.videoId,
        status: room.playback.status,
        position: this.currentPosition(room), // extrapolated to "now" so clients need no clock sync
        revision: room.playback.revision,
      },
      chat: typeof room.getRecentChat === 'function' ? room.getRecentChat(40) : [],
      pendingRequests: typeof room.listPendingRequests === 'function' ? room.listPendingRequests() : [],
      serverTime: this.now(),
    };
  }

  describePublic(roomId) {
    const room = this.store.get(roomId);
    if (!room) return null;
    return { exists: true, participantCount: room.participants.size, hasVideo: Boolean(room.playback.videoId) };
  }

  shutdown() {
    for (const timer of this.graceTimers.values()) clearTimeout(timer);
    this.graceTimers.clear();
  }

  // ---------- Internals ----------

  #requireRoom(roomId) {
    const room = this.store.get(roomId);
    if (!room) throw new AppError(ErrorCodes.ROOM_NOT_FOUND, 'This room does not exist or has ended.');
    return room;
  }

  #requireTarget(room, targetId) {
    const target = room.participants.get(targetId);
    if (!target) throw new AppError(ErrorCodes.TARGET_NOT_FOUND, 'That participant is no longer in the room.');
    return target;
  }

  #addParticipant(room, name, role, socketId, userId = null) {
    const participant = new Participant({
      id: newParticipantId(),
      userId,
      name,
      role,
      token: newReconnectToken(),
      socketId,
      connected: true,
      joinedAt: this.now(),
    });
    room.participants.set(participant.id, participant);
    return participant;
  }

  #reattach(room, participant, socketId) {
    const displacedSocketId =
      participant.socketId && participant.socketId !== socketId ? participant.socketId : null;
    this.#clearGraceTimer(room.id, participant.id);
    participant.socketId = socketId;
    participant.connected = true;
    return { room, participant, rejoined: true, displacedSocketId };
  }

  #commitPlayback(room, changes) {
    room.playback = {
      ...room.playback,
      ...changes,
      updatedAt: this.now(),
      revision: room.playback.revision + 1,
    };
  }

  /** Remove a seat, hand the room to a successor if needed, delete the room when empty. */
  #removeParticipant(room, participant, reason) {
    this.#clearGraceTimer(room.id, participant.id);
    room.participants.delete(participant.id);

    let newHostId = null;
    if (room.participants.size === 0) {
      this.store.delete(room.id);
      this.emit('room_closed', { roomId: room.id });
    } else if (participant.id === room.hostId) {
      // Host-transfer policy: promote the longest-standing moderator, else the longest-standing
      // connected participant, else anyone left. The room is never left without a host.
      const successor = this.#pickSuccessor(room);
      successor.role = Roles.HOST;
      room.hostId = successor.id;
      newHostId = successor.id;
    }
    if (this.store.get(room.id)) {
      this.emit('participant_left', { roomId: room.id, participant, reason, newHostId });
    }
  }

  #pickSuccessor(room) {
    const byJoin = [...room.participants.values()].sort((a, b) => a.joinedAt - b.joinedAt);
    return (
      byJoin.find((p) => p.role === Roles.MODERATOR && p.connected) ??
      byJoin.find((p) => p.connected) ??
      byJoin[0]
    );
  }

  #timerKey(roomId, participantId) {
    return `${roomId}:${participantId}`;
  }

  #clearGraceTimer(roomId, participantId) {
    const key = this.#timerKey(roomId, participantId);
    clearTimeout(this.graceTimers.get(key));
    this.graceTimers.delete(key);
  }
}
