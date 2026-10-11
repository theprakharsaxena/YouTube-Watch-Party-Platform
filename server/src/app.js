import express from 'express';
import cors from 'cors';
import { normalizeRoomId } from './rooms/roomValidation.js';
import { AppError } from './utils/errors.js';
import { AuthService } from './auth/authService.js';

export function createApp({ config, roomService, authService = new AuthService() }) {
  const app = express();
  app.disable('x-powered-by');
  app.set('json spaces', 2);
  app.use(cors({ origin: config.clientOrigins }));
  app.use(express.json({ limit: '10kb' }));

  app.get('/', (_req, res) => {
    const uptimeSeconds = Math.round(process.uptime());
    const formatUptime = (s) => {
      const d = Math.floor(s / 86400);
      const h = Math.floor((s % 86400) / 3600);
      const m = Math.floor((s % 3600) / 60);
      const sec = s % 60;
      return [d ? `${d}d` : '', h ? `${h}h` : '', m ? `${m}m` : '', `${sec}s`].filter(Boolean).join(' ') || '0s';
    };
    const roomsCount = roomService.store ? roomService.store.size : 0;

    res.json({
      name: 'WatchAlong Real-Time Watch Party Server',
      status: 'ok',
      version: '1.0.0',
      description: 'Real-time collaborative YouTube watch party backend service',
      uptime: {
        seconds: uptimeSeconds,
        humanReadable: formatUptime(uptimeSeconds)
      },
      uptimeSeconds,
      rooms: roomsCount,
      endpoints: {
        health: '/health',
        realtime: '/socket.io/',
        rooms: '/api/rooms/:roomId',
        auth: {
          register: '/api/auth/register',
          login: '/api/auth/login',
          guest: '/api/auth/guest',
          me: '/api/auth/me'
        }
      }
    });
  });

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', rooms: roomService.store.size, uptimeSeconds: Math.round(process.uptime()) });
  });

  app.post('/api/auth/register', (req, res) => {
    try {
      const result = authService.register(req.body ?? {});
      res.status(201).json(result);
    } catch (error) {
      if (error instanceof AppError) return res.status(400).json({ code: error.code, message: error.message });
      res.status(500).json({ code: 'INTERNAL', message: 'Registration failed.' });
    }
  });

  app.post('/api/auth/login', (req, res) => {
    try {
      const result = authService.login(req.body ?? {});
      res.json(result);
    } catch (error) {
      if (error instanceof AppError) return res.status(401).json({ code: error.code, message: error.message });
      res.status(500).json({ code: 'INTERNAL', message: 'Login failed.' });
    }
  });

  app.post('/api/auth/guest', (req, res) => {
    try {
      const result = authService.guestLogin(req.body ?? {});
      res.json(result);
    } catch (error) {
      if (error instanceof AppError) return res.status(400).json({ code: error.code, message: error.message });
      res.status(500).json({ code: 'INTERNAL', message: 'Guest session failed.' });
    }
  });

  app.get('/api/auth/me', (req, res) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const user = authService.verifyToken(token);
    if (!user) return res.status(401).json({ code: 'UNAUTHORIZED', message: 'Invalid or expired session.' });
    res.json({ user });
  });

  app.get('/api/rooms/:roomId', (req, res) => {
    try {
      const roomId = normalizeRoomId(req.params.roomId);
      const info = roomService.describePublic(roomId);
      if (!info) return res.status(404).json({ code: 'ROOM_NOT_FOUND', message: 'This room does not exist or has ended.' });

      const authHeader = req.headers.authorization;
      const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
      if (token) {
        try {
          const user = authService.verifyToken(token);
          if (user?.id) {
            const isHost = (info.hostUserId && info.hostUserId === user.id) ||
                           (info.creatorUserId && info.creatorUserId === user.id);
            info.isHost = Boolean(isHost);
          }
        } catch {

        }
      }

      return res.json(info);
    } catch (error) {
      if (error instanceof AppError) return res.status(400).json({ code: error.code, message: error.message });
      throw error;
    }
  });

  app.use((_req, res) => res.status(404).json({ code: 'NOT_FOUND', message: 'Not found.' }));

  app.use((error, _req, res, _next) => {
    console.error('[http]', error);
    res.status(500).json({ code: 'INTERNAL', message: 'Something went wrong on the server.' });
  });

  return app;
}

