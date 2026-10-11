import { Roles } from '../auth/permissions.js';
import { Participant } from './Participant.js';

export class Room {
  constructor({
    id,
    createdAt = Date.now(),
    hostId = null,
    creatorUserId = null,
    participants = new Map(),
    removedTokens = new Set(),
    removedUserIds = new Set(),
    playback = null,
    chatMessages = [],
  }) {
    this.id = id;
    this.createdAt = createdAt;
    this.hostId = hostId;
    this.creatorUserId = creatorUserId;
    this.participants = participants instanceof Map ? participants : new Map();
    this.removedTokens = removedTokens instanceof Set ? removedTokens : new Set(removedTokens);
    this.removedUserIds = removedUserIds instanceof Set ? removedUserIds : new Set(removedUserIds);
    this.playback = playback || {
      videoId: null,
      status: 'paused',
      position: 0,
      updatedAt: createdAt,
      revision: 0,
    };
    this.chatMessages = Array.isArray(chatMessages) ? chatMessages : [];
    this.maxChatHistory = 100;
    this.pendingRequests = new Map();
  }

  addParticipant(participant) {
    this.participants.set(participant.id, participant);
  }

  getParticipant(participantId) {
    return this.participants.get(participantId);
  }

  findParticipantByToken(token) {
    if (!token) return null;
    for (const p of this.participants.values()) {
      if (p.token === token) return p;
    }
    return null;
  }

  hasParticipant(participantId) {
    return this.participants.has(participantId);
  }

  removeParticipant(participantId) {
    const p = this.participants.get(participantId);
    if (!p) return false;
    this.removedTokens.add(p.token);
    return this.participants.delete(participantId);
  }

  activeParticipantsCount() {
    let count = 0;
    for (const p of this.participants.values()) {
      if (p.connected) count += 1;
    }
    return count;
  }

  listPublicParticipants() {
    return Array.from(this.participants.values())
      .map((p) => p.toPublic())
      .sort((a, b) => a.joinedAt - b.joinedAt);
  }

  setHost(newHostId) {
    const target = this.participants.get(newHostId);
    if (!target) return false;

    if (this.hostId && this.hostId !== newHostId) {
      const currentHost = this.participants.get(this.hostId);
      if (currentHost) {
        currentHost.setRole(Roles.MODERATOR);
      }
    }

    target.setRole(Roles.HOST);
    this.hostId = target.id;
    return true;
  }

  transferHost(newHostId) {
    return this.setHost(newHostId);
  }

  updatePlayback({ status, position, videoId, now = Date.now() }) {
    if (status !== undefined) this.playback.status = status;
    if (position !== undefined) this.playback.position = position;
    if (videoId !== undefined) this.playback.videoId = videoId;
    this.playback.updatedAt = now;
    this.playback.revision += 1;
    return this.playback;
  }

  addChatMessage({ senderId, senderName, senderRole, text, type = 'user', now = Date.now() }) {
    const message = {
      id: `${this.id}:${now}:${Math.random().toString(36).slice(2, 7)}`,
      senderId,
      senderName,
      senderRole,
      text,
      type,
      timestamp: now,
    };
    this.chatMessages.push(message);
    if (this.chatMessages.length > this.maxChatHistory) {
      this.chatMessages.shift();
    }
    return message;
  }

  getRecentChat(limit = 50) {
    return this.chatMessages.slice(-limit);
  }

  addChangeRequest({ requesterId, requesterName, requesterRole, type, payload, now = Date.now() }) {
    const requestId = 'req_' + Math.random().toString(36).slice(2, 9);
    const request = {
      id: requestId,
      requesterId,
      requesterName,
      requesterRole,
      type,
      payload,
      createdAt: now,
    };
    this.pendingRequests.set(requestId, request);
    return request;
  }

  getChangeRequest(requestId) {
    return this.pendingRequests.get(requestId);
  }

  removeChangeRequest(requestId) {
    return this.pendingRequests.delete(requestId);
  }

  listPendingRequests() {
    return Array.from(this.pendingRequests.values());
  }

  toSnapshot(now = Date.now()) {

    let currentPos = this.playback.position;
    if (this.playback.status === 'playing') {
      const elapsed = Math.max(0, (now - this.playback.updatedAt) / 1000);
      currentPos += elapsed;
    }

    return {
      roomId: this.id,
      hostId: this.hostId,
      playback: {
        ...this.playback,
        position: currentPos,
      },
      participants: this.listPublicParticipants(),
      chat: this.getRecentChat(30),
      pendingRequests: this.listPendingRequests(),
    };
  }

  toJSON() {
    return {
      id: this.id,
      createdAt: this.createdAt,
      hostId: this.hostId,
      creatorUserId: this.creatorUserId,
      participants: Array.from(this.participants.values()).map((p) => p.toJSON()),
      removedTokens: Array.from(this.removedTokens),
      removedUserIds: Array.from(this.removedUserIds),
      playback: this.playback,
      chatMessages: this.chatMessages,
      pendingRequests: this.listPendingRequests(),
    };
  }

  static fromJSON(data) {
    const participants = new Map();
    if (Array.isArray(data.participants)) {
      for (const pData of data.participants) {
        const participant = Participant.fromJSON(pData);
        participants.set(participant.id, participant);
      }
    }
    return new Room({
      id: data.id,
      createdAt: data.createdAt,
      hostId: data.hostId,
      creatorUserId: data.creatorUserId ?? null,
      participants,
      removedTokens: new Set(data.removedTokens || []),
      removedUserIds: new Set(data.removedUserIds || []),
      playback: data.playback,
      chatMessages: data.chatMessages || [],
    });
  }
}

