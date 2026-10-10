import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { RoomService } from '../src/rooms/roomService.js';
import { Room } from '../src/rooms/Room.js';
import { Participant } from '../src/rooms/Participant.js';
import { PersistentRoomStore } from '../src/rooms/persistentRoomStore.js';
import { SqliteRoomStore } from '../src/rooms/sqliteRoomStore.js';
import { AuthService } from '../src/auth/authService.js';
import { Roles } from '../src/auth/permissions.js';
import { loadConfig } from '../src/config/index.js';

describe('OOP Classes & Chat / Reactions', () => {
  let clock;
  let service;
  let host;
  let room;
  const id = (participant, socketId) => ({ roomId: room.id, participantId: participant.id, socketId });

  beforeEach(() => {
    clock = 1_000_000;
    service = new RoomService({ config: loadConfig({ REQUIRE_AUTH: 'false' }), now: () => clock });
    ({ room, participant: host } = service.createRoom({
      displayName: 'Alice',
      videoInput: 'https://youtu.be/dQw4w9WgXcQ',
      socketId: 's-alice',
    }));
  });

  test('Room and Participant are instances of OOP classes', () => {
    assert.ok(room instanceof Room);
    assert.ok(host instanceof Participant);
    assert.equal(room.hostId, host.id);
    assert.equal(host.role, 'host');
    assert.equal(host.toPublic().token, undefined);
  });

  test('addChatMessage adds message, enforces constraints and is returned in snapshot', () => {
    const { message } = service.addChatMessage(id(host, 's-alice'), 'Hello watch party!');
    assert.equal(message.text, 'Hello watch party!');
    assert.equal(message.senderName, 'Alice');
    assert.equal(message.senderRole, 'host');

    // Empty message throws
    assert.throws(() => service.addChatMessage(id(host, 's-alice'), '   '), { code: 'INVALID_PAYLOAD' });

    // Snapshot contains chat
    const snap = service.snapshot(room);
    assert.equal(snap.chat.length, 1);
    assert.equal(snap.chat[0].text, 'Hello watch party!');
  });

  test('recordReaction validates emoji and records timestamp', () => {
    const { reaction } = service.recordReaction(id(host, 's-alice'), '🔥');
    assert.equal(reaction.emoji, '🔥');
    assert.equal(reaction.senderName, 'Alice');

    // Disallowed emoji throws
    assert.throws(() => service.recordReaction(id(host, 's-alice'), 'invalid'), { code: 'INVALID_PAYLOAD' });
  });

  test('Participant change request approval workflow', () => {
    const { participant: guest } = service.joinRoom({
      roomId: room.id,
      displayName: 'Bob',
      socketId: 's-bob',
    });

    // Bob (participant) requests to change video
    const { request } = service.requestChange(id(guest, 's-bob'), {
      type: 'change_video',
      payload: { videoUrl: 'https://youtu.be/jNQXAC9IJRE' },
    });
    assert.equal(request.requesterName, 'Bob');
    assert.equal(request.type, 'change_video');

    // Snapshot contains pending request
    let snap = service.snapshot(room);
    assert.equal(snap.pendingRequests.length, 1);
    assert.equal(snap.pendingRequests[0].id, request.id);

    // Non-host/mod cannot approve request
    assert.throws(
      () => service.respondChangeRequest(id(guest, 's-bob'), { requestId: request.id, approved: true }),
      { code: 'FORBIDDEN' },
    );

    // Host approves request -> video changes!
    const { approved, actionResult } = service.respondChangeRequest(id(host, 's-alice'), {
      requestId: request.id,
      approved: true,
    });
    assert.ok(approved);
    assert.equal(actionResult.action.videoId, 'jNQXAC9IJRE');

    // Room video is now updated
    assert.equal(room.playback.videoId, 'jNQXAC9IJRE');
    snap = service.snapshot(room);
    assert.equal(snap.pendingRequests.length, 0);
  });

  test('AuthService registers, logs in, hashes password and verifies token', () => {
    const auth = new AuthService({ filePath: `/tmp/test_users_${Date.now()}_${Math.random()}.json` });
    const reg = auth.register({ email: 'prakhar@example.com', displayName: 'Prakhar Saxena', password: 'secretpassword123' });
    assert.equal(reg.user.email, 'prakhar@example.com');
    assert.equal(reg.user.displayName, 'Prakhar Saxena');
    assert.ok(reg.token);

    const login = auth.login({ email: 'prakhar@example.com', password: 'secretpassword123' });
    assert.equal(login.user.email, 'prakhar@example.com');
    assert.equal(login.user.displayName, 'Prakhar Saxena');

    assert.throws(() => auth.login({ email: 'prakhar@example.com', password: 'wrong' }), { code: 'NOT_IN_ROOM' });

    const verified = auth.verifyToken(login.token);
    assert.equal(verified.email, 'prakhar@example.com');
    assert.equal(verified.displayName, 'Prakhar Saxena');

    // Multiple accounts can share the exact same display name, uniquely identified by email
    const reg2 = auth.register({ email: 'another@example.com', displayName: 'Prakhar Saxena', password: 'secretpassword456' });
    assert.equal(reg2.user.displayName, 'Prakhar Saxena');
    assert.equal(reg2.user.email, 'another@example.com');
    assert.notEqual(reg2.user.id, reg.user.id);

    // Duplicate email is rejected
    assert.throws(() => auth.register({ email: 'prakhar@example.com', displayName: 'Anyone', password: 'password123' }), {
      code: 'INVALID_PAYLOAD',
    });
  });

  test('PersistentRoomStore and SqliteRoomStore serialize and restore rooms', () => {
    const jsonStore = new PersistentRoomStore({ filePath: '/tmp/test_sidelight_rooms.json' });
    const sqliteStore = new SqliteRoomStore({ dbPath: '/tmp/test_sidelight.db' });

    for (const store of [jsonStore, sqliteStore]) {
      const r = new Room({ id: 'ROOM123456', createdAt: 12345 });
      const p1 = new Participant({ id: 'p1', name: 'Bob', role: Roles.HOST });
      const p2 = new Participant({ id: 'p2', name: 'Charlie', role: Roles.VIEWER });
      r.addParticipant(p1);
      r.addParticipant(p2);
      r.setHost('p1');
      store.set(r);

      const retrieved = store.get('ROOM123456');
      assert.equal(retrieved.id, 'ROOM123456');
      assert.equal(retrieved.hostId, 'p1');
      assert.equal(retrieved.participants.get('p1').name, 'Bob');
      assert.equal(retrieved.participants.get('p2').role, Roles.VIEWER);
    }
  });
});
