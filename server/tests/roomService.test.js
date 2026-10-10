import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { RoomService } from '../src/rooms/roomService.js';
import { loadConfig } from '../src/config/index.js';
import { extractVideoId, normalizeRoomId } from '../src/rooms/roomValidation.js';

const VIDEO = 'dQw4w9WgXcQ';

describe('RoomService', () => {
  let clock;
  let service;
  let host;
  let room;
  const id = (participant, socketId) => ({ roomId: room.id, participantId: participant.id, socketId });

  beforeEach(() => {
    clock = 1_000_000;
    service = new RoomService({ config: loadConfig({ REQUIRE_AUTH: 'false' }), now: () => clock });
    ({ room, participant: host } = service.createRoom({
      displayName: 'Hana',
      videoInput: `https://youtu.be/${VIDEO}`,
      socketId: 's-host',
    }));
  });

  const join = (name, socketId, token) =>
    service.joinRoom({ roomId: room.id, displayName: name, socketId, token }).participant;

  test('room creation assigns Host to the creator and ignores any client role', () => {
    assert.equal(host.role, 'host');
    assert.equal(room.hostId, host.id);
    assert.equal(room.playback.videoId, VIDEO);
    assert.match(room.id, /^[A-Z2-9]{10}$/);
  });

  test('a room can be created without a video', () => {
    const { room: empty } = service.createRoom({ displayName: 'A', socketId: 'x' });
    assert.equal(empty.playback.videoId, null);
  });

  test('a new joiner is a Participant and receives the full current state', () => {
    service.applyPlaybackCommand(id(host, 's-host'), { type: 'play', position: 42 });
    clock += 3000;
    const guest = join('Ines', 's-1');
    assert.equal(guest.role, 'participant');
    const snap = service.snapshot(room);
    assert.equal(snap.playback.videoId, VIDEO);
    assert.equal(snap.playback.status, 'playing');
    assert.equal(snap.playback.position, 45); // 42s + 3s elapsed
    assert.equal(snap.participants.length, 2);
    assert.ok(!JSON.stringify(snap).includes(guest.token), 'tokens must not leak into snapshots');
  });

  test('a participant cannot play, pause, or seek', () => {
    const guest = join('Ines', 's-1');
    for (const type of ['play', 'pause', 'seek']) {
      assert.throws(
        () => service.applyPlaybackCommand(id(guest, 's-1'), { type, position: 5 }),
        { code: 'FORBIDDEN' },
      );
    }
    assert.equal(room.playback.status, 'paused');
  });

  test('a participant cannot change the video', () => {
    const guest = join('Ines', 's-1');
    assert.throws(() => service.changeVideo(id(guest, 's-1'), VIDEO), { code: 'FORBIDDEN' });
  });

  test('a participant cannot promote themselves', () => {
    const guest = join('Ines', 's-1');
    assert.throws(() => service.assignRole(id(guest, 's-1'), guest.id, 'moderator'), { code: 'FORBIDDEN' });
    assert.throws(() => service.assignRole(id(guest, 's-1'), guest.id, 'host'), { code: 'FORBIDDEN' });
    assert.equal(guest.role, 'participant');
  });

  test('only the host can promote; moderators cannot promote others', () => {
    const mod = join('Mo', 's-1');
    const other = join('Oz', 's-2');
    service.assignRole(id(host, 's-host'), mod.id, 'moderator');
    assert.equal(mod.role, 'moderator');
    assert.throws(() => service.assignRole(id(mod, 's-1'), other.id, 'moderator'), { code: 'FORBIDDEN' });
    assert.equal(other.role, 'participant');
  });

  test('invalid roles and self-targeting are rejected', () => {
    const guest = join('Ines', 's-1');
    assert.throws(() => service.assignRole(id(host, 's-host'), guest.id, 'admin'), { code: 'INVALID_ROLE' });
    assert.throws(() => service.assignRole(id(host, 's-host'), host.id, 'participant'), { code: 'INVALID_TARGET' });
  });

  test('host transfer demotes the old host to moderator', () => {
    const guest = join('Ines', 's-1');
    service.assignRole(id(host, 's-host'), guest.id, 'host');
    assert.equal(guest.role, 'host');
    assert.equal(host.role, 'moderator');
    assert.equal(room.hostId, guest.id);
  });

  test('a moderator can play, pause, seek and change video', () => {
    const mod = join('Mo', 's-1');
    service.assignRole(id(host, 's-host'), mod.id, 'moderator');
    service.applyPlaybackCommand(id(mod, 's-1'), { type: 'play', position: 10 });
    assert.equal(room.playback.status, 'playing');
    service.applyPlaybackCommand(id(mod, 's-1'), { type: 'seek', position: 90 });
    assert.equal(room.playback.position, 90);
    assert.equal(room.playback.status, 'playing');
    service.applyPlaybackCommand(id(mod, 's-1'), { type: 'pause' });
    assert.equal(room.playback.status, 'paused');
    service.changeVideo(id(mod, 's-1'), 'https://www.youtube.com/watch?v=aqz-KE-bpKQ');
    assert.equal(room.playback.videoId, 'aqz-KE-bpKQ');
    assert.equal(room.playback.position, 0);
  });

  test('revision increases on every accepted change and not on rejected ones', () => {
    const guest = join('Ines', 's-1');
    const start = room.playback.revision;
    service.applyPlaybackCommand(id(host, 's-host'), { type: 'play', position: 0 });
    assert.throws(() => service.applyPlaybackCommand(id(guest, 's-1'), { type: 'pause' }));
    assert.equal(room.playback.revision, start + 1);
  });

  test('invalid playback payloads are rejected', () => {
    const bad = [
      [{ type: 'seek' }, 'INVALID_POSITION'],
      [{ type: 'seek', position: -1 }, 'INVALID_POSITION'],
      [{ type: 'seek', position: Number.NaN }, 'INVALID_POSITION'],
      [{ type: 'seek', position: '10' }, 'INVALID_POSITION'],
      [{ type: 'seek', position: 1e9 }, 'INVALID_POSITION'],
      [{ type: 'rewind' }, 'INVALID_PAYLOAD'],
      [null, 'INVALID_PAYLOAD'],
    ];
    for (const [command, code] of bad) {
      assert.throws(() => service.applyPlaybackCommand(id(host, 's-host'), command), { code });
    }
    assert.throws(() => service.changeVideo(id(host, 's-host'), 'https://evil.example/watch?v=dQw4w9WgXcQ'), {
      code: 'INVALID_VIDEO',
    });
  });

  test('playback needs a video', () => {
    const { room: empty, participant } = service.createRoom({ displayName: 'A', socketId: 'x' });
    assert.throws(
      () => service.applyPlaybackCommand({ roomId: empty.id, participantId: participant.id, socketId: 'x' }, { type: 'play' }),
      { code: 'NO_VIDEO' },
    );
  });

  test('only the host can remove participants; the host cannot be removed', () => {
    const mod = join('Mo', 's-1');
    const guest = join('Ines', 's-2');
    service.assignRole(id(host, 's-host'), mod.id, 'moderator');
    assert.throws(() => service.removeParticipant(id(mod, 's-1'), guest.id), { code: 'FORBIDDEN' });
    assert.throws(() => service.removeParticipant(id(guest, 's-2'), mod.id), { code: 'FORBIDDEN' });
    assert.throws(() => service.removeParticipant(id(host, 's-host'), host.id), { code: 'INVALID_TARGET' });
    service.removeParticipant(id(host, 's-host'), guest.id);
    assert.equal(room.participants.has(guest.id), false);
  });

  test('a removed participant can no longer control the room or rejoin with their token', () => {
    const mod = join('Mo', 's-1');
    service.assignRole(id(host, 's-host'), mod.id, 'moderator');
    const { token } = mod;
    service.removeParticipant(id(host, 's-host'), mod.id);
    assert.throws(() => service.applyPlaybackCommand(id(mod, 's-1'), { type: 'play' }), { code: 'NOT_IN_ROOM' });
    assert.throws(() => join('Mo', 's-9', token), { code: 'REMOVED_FROM_ROOM' });
    assert.equal(service.snapshot(room).participants.length, 1);
  });

  test('a socket that does not own a seat cannot act as that participant', () => {
    assert.throws(
      () => service.applyPlaybackCommand({ roomId: room.id, participantId: host.id, socketId: 'attacker' }, { type: 'play' }),
      { code: 'NOT_IN_ROOM' },
    );
  });

  test('repeated joins from one socket and reconnects do not duplicate seats', () => {
    const guest = join('Ines', 's-1');
    join('Ines', 's-1'); // same socket twice
    service.handleDisconnect({ roomId: room.id, participantId: guest.id, socketId: 's-1' });
    const again = service.joinRoom({ roomId: room.id, displayName: 'x', token: guest.token, socketId: 's-2' });
    assert.equal(again.rejoined, true);
    assert.equal(again.participant.id, guest.id);
    assert.equal(service.snapshot(room).participants.length, 2);
  });

  test('a reconnect token restores the seat but never upgrades the role', () => {
    const guest = join('Ines', 's-1');
    service.handleDisconnect({ roomId: room.id, participantId: guest.id, socketId: 's-1' });
    const again = service.joinRoom({ roomId: room.id, displayName: 'Ines', token: guest.token, socketId: 's-2' });
    assert.equal(again.participant.role, 'participant');
    // Name alone (no token) does not restore the host seat.
    const impostor = service.joinRoom({ roomId: room.id, displayName: 'Hana', socketId: 's-3' });
    assert.equal(impostor.participant.role, 'participant');
    assert.notEqual(impostor.participant.id, host.id);
  });

  test('reconnect with a token from another socket displaces the old socket', () => {
    const guest = join('Ines', 's-1');
    const again = service.joinRoom({ roomId: room.id, displayName: 'x', token: guest.token, socketId: 's-2' });
    assert.equal(again.displacedSocketId, 's-1');
    assert.throws(() => service.requireMember(id(guest, 's-1')), { code: 'NOT_IN_ROOM' });
  });

  test('host leaving transfers host to a moderator first; empty rooms are deleted', () => {
    const guest = join('Ines', 's-1');
    const mod = join('Mo', 's-2');
    service.assignRole(id(host, 's-host'), mod.id, 'moderator');
    const left = [];
    service.on('participant_left', (event) => left.push(event));
    service.leaveRoom(id(host, 's-host'));
    assert.equal(room.hostId, mod.id);
    assert.equal(mod.role, 'host');
    assert.equal(left[0].newHostId, mod.id);
    service.leaveRoom(id(mod, 's-2'));
    service.leaveRoom(id(guest, 's-1'));
    assert.equal(service.store.get(room.id), undefined);
  });

  test('disconnected participants are removed after the grace period', async () => {
    const quick = new RoomService({ config: loadConfig({ RECONNECT_GRACE_MS: '20', REQUIRE_AUTH: 'false' }) });
    const { room: r, participant: h } = quick.createRoom({ displayName: 'H', socketId: 'a' });
    const g = quick.joinRoom({ roomId: r.id, displayName: 'G', socketId: 'b' }).participant;
    quick.handleDisconnect({ roomId: r.id, participantId: g.id, socketId: 'b' });
    assert.equal(quick.snapshot(r).participants.find((p) => p.id === g.id).connected, false);
    await new Promise((resolve) => setTimeout(resolve, 60));
    assert.equal(r.participants.has(g.id), false);
    assert.equal(r.participants.has(h.id), true);
    quick.shutdown();
  });

  test('unknown rooms and bad names are rejected', () => {
    assert.throws(() => service.joinRoom({ roomId: 'ZZZZZZZZZZ', displayName: 'A', socketId: 'q' }), {
      code: 'ROOM_NOT_FOUND',
    });
    assert.throws(() => service.createRoom({ displayName: '   ', socketId: 'q' }), { code: 'INVALID_NAME' });
    assert.throws(() => service.createRoom({ displayName: 'x'.repeat(200), socketId: 'q' }), { code: 'INVALID_NAME' });
  });
});

describe('validation helpers', () => {
  test('extractVideoId supports watch, youtu.be, embed, shorts and bare IDs', () => {
    assert.equal(extractVideoId(`https://www.youtube.com/watch?v=${VIDEO}&t=10s`), VIDEO);
    assert.equal(extractVideoId(`https://youtu.be/${VIDEO}?si=abc`), VIDEO);
    assert.equal(extractVideoId(`https://www.youtube.com/embed/${VIDEO}`), VIDEO);
    assert.equal(extractVideoId(`https://youtube.com/shorts/${VIDEO}`), VIDEO);
    assert.equal(extractVideoId(`youtube.com/watch?v=${VIDEO}`), VIDEO);
    assert.equal(extractVideoId(VIDEO), VIDEO);
  });

  test('extractVideoId rejects other hosts, schemes and junk', () => {
    assert.equal(extractVideoId('https://vimeo.com/12345678901'), null);
    assert.equal(extractVideoId(`javascript:alert(1)//youtu.be/${VIDEO}`), null);
    assert.equal(extractVideoId('https://www.youtube.com/watch?v=short'), null);
    assert.equal(extractVideoId(`https://youtube.com.evil.io/watch?v=${VIDEO}`), null);
    assert.equal(extractVideoId(42), null);
  });

  test('normalizeRoomId tolerates case and separators', () => {
    assert.equal(normalizeRoomId('abcde-fghjk'), 'ABCDEFGHJK');
    assert.throws(() => normalizeRoomId('nope'), { code: 'INVALID_ROOM' });
  });
});
