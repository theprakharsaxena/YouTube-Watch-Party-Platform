import http from 'node:http';
import { createApp } from './app.js';
import { loadConfig } from './config/index.js';
import { RoomService } from './rooms/roomService.js';
import { PersistentRoomStore } from './rooms/persistentRoomStore.js';
import { SqliteRoomStore } from './rooms/sqliteRoomStore.js';
import { createSocketServer } from './realtime/socketServer.js';
import { AuthService } from './auth/authService.js';

/** Build the whole stack without listening, so tests can choose their own port. */
export function createServer(config = loadConfig(), { store, authService: injectedAuth } = {}) {
  const roomStore =
    store ??
    (process.env.PERSISTENCE === 'false'
      ? undefined
      : process.env.PERSISTENCE_DRIVER === 'sqlite'
        ? new SqliteRoomStore()
        : new PersistentRoomStore());
  const authService = injectedAuth ?? new AuthService();
  const roomService = new RoomService({ config, store: roomStore, authService });
  const app = createApp({ config, roomService, authService });
  const httpServer = http.createServer(app);
  const io = createSocketServer(httpServer, { roomService, config, authService });
  return { httpServer, io, roomService, authService, config };
}

const isEntrypoint = import.meta.url === `file://${process.argv[1]}`;
if (isEntrypoint) {
  const { httpServer, io, roomService, config } = createServer();
  httpServer.listen(config.port, () => {
    console.log(`WatchAlong server listening on :${config.port}`);
    console.log(`Allowed client origins: ${config.clientOrigins.join(', ')}`);
  });
  const shutdown = () => {
    roomService.shutdown();
    io.close(() => process.exit(0));
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
