import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { io as connect } from 'socket.io-client';
import { createServer } from '../src/server.js';
import { loadConfig } from '../src/config/index.js';

const VIDEO = 'dQw4w9WgXcQ';

// Real Socket.IO round trips against an in-process server on an ephemeral port.
describe('socket integration', () => {
  let server;
  let url;
  const sockets = [];

  before(async () => {
    server = createServer(loadConfig({ RECONNECT_GRACE_MS: '5000', REQUIRE_AUTH: 'false' }));
    await new Promise((resolve) => server.httpServer.listen(0, resolve));
    url = `http://localhost:${server.httpServer.address().port}`;
  });

  after(async () => {
    sockets.forEach((s) => s.close());
    server.roomService.shutdown();
    await new Promise((resolve) => server.io.close(resolve));
  });

  const client = () => {
    const socket = connect(url, { transports: ['websocket'], forceNew: true });
    sockets.push(socket);
    return socket;
  };
  const once = (socket, event, timeoutMs = 2000) =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), timeoutMs);
      socket.once(event, (data) => {
        clearTimeout(timer);
        resolve(data);
      });
    });
  const quiet = (socket, event, ms = 250) =>
    new Promise((resolve, reject) => {
      const handler = () => reject(new Error(`unexpected ${event}`));
      socket.once(event, handler);
      setTimeout(() => {
        socket.off(event, handler);
        resolve();
      }, ms);
    });

  async function setupRoom() {
    const host = client();
    host.emit('create_room', { displayName: 'Host', videoUrl: `https://youtu.be/${VIDEO}`, role: 'host' });
    const created = await once(host, 'room_created');
    const guest = client();
    guest.emit('join_room', { roomId: created.roomId, displayName: 'Guest', role: 'host' });
    const joined = await once(guest, 'room_joined');
    return { host, guest, created, joined };
  }

  test('create + join: roles come from the server, joiner gets full state', async () => {
    const { created, joined } = await setupRoom();
    assert.equal(created.state.participants[0].role, 'host');
    const guest = joined.state.participants.find((p) => p.id === joined.participantId);
    assert.equal(guest.role, 'participant'); // payload role: 'host' was ignored
    assert.equal(joined.state.playback.videoId, VIDEO);
    assert.equal(joined.state.participants.length, 2);
  });

  test('host playback reaches the participant; participant commands are rejected', async () => {
    const { host, guest } = await setupRoom();
    const received = once(guest, 'playback_updated');
    host.emit('playback_command', { type: 'play', position: 12 });
    const update = await received;
    assert.equal(update.state.playback.status, 'playing');
    assert.ok(update.state.playback.position >= 12);
    assert.equal(update.by.name, 'Host');

    const error = once(guest, 'room_error');
    const leak = quiet(host, 'playback_updated');
    guest.emit('playback_command', { type: 'pause' });
    assert.equal((await error).code, 'FORBIDDEN');
    await leak; // nothing was broadcast for the rejected command
  });

  test('promotion, moderator control, removal and post-removal rejection', async () => {
    const { host, guest, joined } = await setupRoom();
    const roleUpdate = once(guest, 'role_updated');
    host.emit('assign_role', { targetId: joined.participantId, role: 'moderator' });
    assert.equal((await roleUpdate).role, 'moderator');

    const played = once(host, 'playback_updated');
    guest.emit('playback_command', { type: 'seek', position: 30 });
    assert.equal((await played).state.playback.position, 30);

    const removed = once(guest, 'participant_removed');
    host.emit('remove_participant', { targetId: joined.participantId });
    assert.equal((await removed).removed, true);

    const error = once(guest, 'room_error');
    guest.emit('playback_command', { type: 'pause' });
    assert.equal((await error).code, 'NOT_IN_ROOM');
  });

  test('refresh/reconnect with token restores the same seat without duplicates', async () => {
    const { host, guest, created, joined } = await setupRoom();
    guest.close();
    await once(host, 'room_state');
    const again = client();
    again.emit('join_room', { roomId: created.roomId, displayName: 'Guest', token: joined.token });
    const rejoined = await once(again, 'room_joined');
    assert.equal(rejoined.rejoined, true);
    assert.equal(rejoined.participantId, joined.participantId);
    assert.equal(rejoined.state.participants.length, 2);
  });

  test('malformed payloads and unknown rooms yield consistent errors', async () => {
    const socket = client();
    await once(socket, 'connect');
    let error = once(socket, 'room_error');
    socket.emit('join_room', { roomId: 'ZZZZZZZZZZ', displayName: 'X' });
    assert.equal((await error).code, 'ROOM_NOT_FOUND');
    error = once(socket, 'room_error');
    socket.emit('join_room', 'not-an-object');
    assert.equal((await error).code, 'INVALID_PAYLOAD');
    error = once(socket, 'room_error');
    socket.emit('playback_command', { type: 'play' });
    assert.equal((await error).code, 'NOT_IN_ROOM');
  });

  test('HTTP health and room lookup', async () => {
    const { created } = await setupRoom();
    assert.equal((await fetch(`${url}/health`)).status, 200);
    const found = await fetch(`${url}/api/rooms/${created.roomId}`);
    const data = await found.json();
    assert.equal(data.participantCount, 2);
    assert.equal(data.hostName, 'Host');
    assert.equal(Boolean(data.hostId), true);
    assert.equal((await fetch(`${url}/api/rooms/ZZZZZZZZZZ`)).status, 404);
    assert.equal((await fetch(`${url}/api/rooms/bad`)).status, 400);
  });
});
