import express from 'express';
import cors from 'cors';
import { normalizeRoomId } from './rooms/roomValidation.js';
import { AppError } from './utils/errors.js';

export function createApp({ config, roomService }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: config.clientOrigins }));
  app.use(express.json({ limit: '10kb' }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', rooms: roomService.store.size, uptimeSeconds: Math.round(process.uptime()) });
  });

  // Lets the join screen validate a code before opening a socket. Reveals only existence/size.
  app.get('/api/rooms/:roomId', (req, res) => {
    try {
      const roomId = normalizeRoomId(req.params.roomId);
      const info = roomService.describePublic(roomId);
      if (!info) return res.status(404).json({ code: 'ROOM_NOT_FOUND', message: 'This room does not exist or has ended.' });
      return res.json(info);
    } catch (error) {
      if (error instanceof AppError) return res.status(400).json({ code: error.code, message: error.message });
      throw error;
    }
  });

  app.use((_req, res) => res.status(404).json({ code: 'NOT_FOUND', message: 'Not found.' }));

  // eslint-disable-next-line no-unused-vars
  app.use((error, _req, res, _next) => {
    console.error('[http]', error);
    res.status(500).json({ code: 'INTERNAL', message: 'Something went wrong on the server.' });
  });

  return app;
}
