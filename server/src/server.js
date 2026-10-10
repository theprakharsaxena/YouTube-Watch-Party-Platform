import http from 'node:http';
import { createApp } from './app.js';
import { loadConfig } from './config/index.js';
import { RoomService } from './rooms/roomService.js';
import { PersistentRoomStore } from './rooms/persistentRoomStore.js';
import { createSocketServer } from './realtime/socketServer.js';

/** Build the whole stack without listening, so tests can choose their own port. */
export function createServer(config = loadConfig(), { store } = {}) {
  const roomStore = store ?? (process.env.PERSISTENCE === 'false' ? undefined : new PersistentRoomStore());
  const roomService = new RoomService({ config, store: roomStore });
  const app = createApp({ config, roomService });
  const httpServer = http.createServer(app);
  const io = createSocketServer(httpServer, { roomService, config });
  return { httpServer, io, roomService, config };
}

const isEntrypoint = import.meta.url === `file://${process.argv[1]}`;
if (isEntrypoint) {
  const { httpServer, io, roomService, config } = createServer();
  httpServer.listen(config.port, () => {
    console.log(`Sidelight server listening on :${config.port}`);
    console.log(`Allowed client origins: ${config.clientOrigins.join(', ')}`);
  });
  const shutdown = () => {
    roomService.shutdown();
    io.close(() => process.exit(0));
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
