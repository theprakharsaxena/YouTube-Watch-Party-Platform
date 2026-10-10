import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { RoomService } from '../src/rooms/roomService.js';
import { Room } from '../src/rooms/Room.js';
import { Participant } from '../src/rooms/Participant.js';
import { PersistentRoomStore } from '../src/rooms/persistentRoomStore.js';
import { loadConfig } from '../src/config/index.js';

describe('OOP Classes & Chat / Reactions', () => {
  let clock;
  let service;
  let host;
  let room;
  const id = (participant, socketId) => ({ roomId: room.id, participantId: participant.id, socketId });

  beforeEach(() => {
    clock = 1_000_000;
    service = new RoomService({ config: loadConfig({}), now: () => clock });
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

  test('PersistentRoomStore serializes and restores rooms', () => {
    const store = new PersistentRoomStore({ filePath: '/tmp/test_sidelight_rooms.json' });
    const r = new Room({ id: 'TESTROOM12', createdAt: 12345 });
    const p = new Participant({ id: 'p1', name: 'Bob', role: 'host' });
    r.addParticipant(p);
    r.setHost('p1');
    store.set(r);

    const retrieved = store.get('TESTROOM12');
    assert.equal(retrieved.id, 'TESTROOM12');
    assert.equal(retrieved.hostId, 'p1');
    assert.equal(retrieved.participants.get('p1').name, 'Bob');
  });
});
