import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { io as connect } from 'socket.io-client';
import { createServer } from '../src/server.js';
import { loadConfig } from '../src/config/index.js';
import { AuthService } from '../src/auth/authService.js';
import { RoomStore } from '../src/rooms/roomManager.js';

// Auth is ON (default): identity comes from the verified session, never the payload.
describe('socket authentication', () => {
  let server;
  let url;
  let auth;
  const sockets = [];

  before(async () => {
    auth = new AuthService({ filePath: join(tmpdir(), `sidelight-users-${process.pid}-${Date.now()}.json`) });
    server = createServer(loadConfig({}), { store: new RoomStore(), authService: auth });
    await new Promise((resolve) => server.httpServer.listen(0, resolve));
    url = `http://localhost:${server.httpServer.address().port}`;
  });

  after(async () => {
    sockets.forEach((s) => s.close());
    server.roomService.shutdown();
    await new Promise((resolve) => server.io.close(resolve));
  });

  const client = (token) => {
    const socket = connect(url, { transports: ['websocket'], forceNew: true, auth: { token }, reconnection: false });
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
  const registered = (name) => auth.register({ username: name, password: 'secret12' });

  test('connection without a valid token is rejected', async () => {
    const anon = client(undefined);
    assert.equal((await once(anon, 'connect_error')).message, 'UNAUTHORIZED');
    const fake = client('not-a-real-token');
    assert.equal((await once(fake, 'connect_error')).message, 'UNAUTHORIZED');
  });

  test('guests cannot host; registered accounts can, and the name comes from the account', async () => {
    const guest = client(auth.guestLogin({ displayName: 'Gus' }).token);
    await once(guest, 'connect');
    guest.emit('create_room', { displayName: 'Hacker' });
    assert.equal((await once(guest, 'room_error')).code, 'ACCOUNT_REQUIRED');

    const host = client(registered('hana_a').token);
    await once(host, 'connect');
    host.emit('create_room', { displayName: 'Spoofed Name' });
    const created = await once(host, 'room_created');
    assert.equal(created.state.participants[0].name, 'hana_a');
    assert.equal(created.state.participants[0].role, 'host');
  });

  test('guests can join; same account reclaims its seat on another socket without a token', async () => {
    const host = client(registered('hana_b').token);
    await once(host, 'connect');
    host.emit('create_room', {});
    const { roomId } = await once(host, 'room_created');

    const guestAuth = auth.guestLogin({ displayName: 'Gus' });
    const first = client(guestAuth.token);
    await once(first, 'connect');
    first.emit('join_room', { roomId, displayName: 'Whatever' });
    const joined = await once(first, 'room_joined');
    assert.equal(joined.state.participants.find((p) => p.id === joined.participantId).name, 'Gus');

    // Same account, new device, no reconnect token: same seat, no duplicate.
    const second = client(guestAuth.token);
    await once(second, 'connect');
    second.emit('join_room', { roomId });
    const again = await once(second, 'room_joined');
    assert.equal(again.participantId, joined.participantId);
    assert.equal(again.state.participants.length, 2);
  });

  test('a removed account cannot rejoin by dropping its reconnect token', async () => {
    const host = client(registered('hana_c').token);
    await once(host, 'connect');
    host.emit('create_room', {});
    const { roomId } = await once(host, 'room_created');

    const kickedAuth = registered('kicked_c');
    const kicked = client(kickedAuth.token);
    await once(kicked, 'connect');
    kicked.emit('join_room', { roomId });
    const joined = await once(kicked, 'room_joined');

    const removed = once(kicked, 'participant_removed');
    host.emit('remove_participant', { targetId: joined.participantId });
    await removed;

    const retry = client(kickedAuth.token);
    await once(retry, 'connect');
    retry.emit('join_room', { roomId }); // no token at all
    assert.equal((await once(retry, 'room_error')).code, 'REMOVED_FROM_ROOM');
  });

  test('guests join as viewers and cannot request video changes; registered users join as participants', async () => {
    const host = client(registered('hana_roles').token);
    await once(host, 'connect');
    host.emit('create_room', {});
    const { roomId } = await once(host, 'room_created');

    // 1. Unlogged-in guest joins without account -> viewer
    const guestAuth = auth.guestLogin({ displayName: 'ViewerBob' });
    const viewer = client(guestAuth.token);
    await once(viewer, 'connect');
    viewer.emit('join_room', { roomId, displayName: 'ViewerBob' });
    const viewerJoined = await once(viewer, 'room_joined');
    const viewerParticipant = viewerJoined.state.participants.find((p) => p.id === viewerJoined.participantId);
    assert.equal(viewerParticipant.role, 'viewer');

    // Viewer cannot request changes
    const deniedPromise = once(viewer, 'room_error');
    viewer.emit('request_change', { type: 'change_video', payload: { videoUrl: 'https://youtu.be/GG1_DsScm6U' } });
    const denied = await deniedPromise;
    assert.equal(denied.code, 'FORBIDDEN');

    // Viewer cannot send chat messages
    const chatDeniedPromise = once(viewer, 'room_error');
    viewer.emit('chat_message', { text: 'Hello from viewer' });
    const chatDenied = await chatDeniedPromise;
    assert.equal(chatDenied.code, 'FORBIDDEN');

    // Viewer cannot send reactions
    const reactDeniedPromise = once(viewer, 'room_error');
    viewer.emit('send_reaction', { emoji: '🔥' });
    const reactDenied = await reactDeniedPromise;
    assert.equal(reactDenied.code, 'FORBIDDEN');

    // Viewer cannot be promoted to moderator/host
    const promoDeniedPromise = once(host, 'room_error');
    host.emit('assign_role', { targetId: viewerJoined.participantId, role: 'moderator' });
    const promoDenied = await promoDeniedPromise;
    assert.equal(promoDenied.code, 'ACCOUNT_REQUIRED');

    // 2. Registered account joins -> participant
    const regMember = client(registered('alice_member').token);
    await once(regMember, 'connect');
    const regJoinedPromise = once(regMember, 'room_joined');
    regMember.emit('join_room', { roomId });
    const regJoined = await regJoinedPromise;
    const regParticipant = regJoined.state.participants.find((p) => p.id === regJoined.participantId);
    assert.equal(regParticipant.role, 'participant');
  });
});
