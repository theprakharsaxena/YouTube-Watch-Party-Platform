import express from 'express';
import cors from 'cors';
import { normalizeRoomId } from './rooms/roomValidation.js';
import { AppError } from './utils/errors.js';
import { AuthService } from './auth/authService.js';

export function createApp({ config, roomService, authService = new AuthService() }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: config.clientOrigins }));
  app.use(express.json({ limit: '10kb' }));

  app.get('/', (req, res) => {
    if (req.accepts('html')) {
      const uptime = Math.round(process.uptime());
      const formatUptime = (s) => {
        const d = Math.floor(s / 86400);
        const h = Math.floor((s % 86400) / 3600);
        const m = Math.floor((s % 3600) / 60);
        const sec = s % 60;
        return [d ? `${d}d` : '', h ? `${h}h` : '', m ? `${m}m` : '', `${sec}s`].filter(Boolean).join(' ') || '0s';
      };
      const rooms = roomService.store ? roomService.store.size : 0;
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WatchAlong Server · Real-Time Watch Party Backend</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
      background: radial-gradient(1000px 600px at 85% -10%, rgba(242, 166, 90, 0.12), transparent 60%),
                  radial-gradient(800px 500px at 10% 100%, rgba(239, 123, 106, 0.08), transparent 60%),
                  #0b1020;
      color: #f4ecdc;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px;
      line-height: 1.5;
    }
    .card {
      width: 100%;
      max-width: 520px;
      background: rgba(16, 23, 44, 0.85);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(244, 236, 220, 0.12);
      border-radius: 20px;
      padding: 36px 32px;
      box-shadow: 0 30px 60px -20px rgba(0, 0, 0, 0.75), 0 0 40px -10px rgba(242, 166, 90, 0.1);
    }
    .header {
      display: flex;
      align-items: center;
      gap: 14px;
      margin-bottom: 20px;
    }
    .logo {
      width: 48px;
      height: 48px;
      border-radius: 14px;
      background: rgba(242, 166, 90, 0.12);
      border: 1px solid rgba(242, 166, 90, 0.35);
      display: grid;
      place-items: center;
      color: #f2a65a;
      flex-shrink: 0;
    }
    .title-group h1 {
      font-size: 1.35rem;
      font-weight: 700;
      letter-spacing: -0.01em;
      color: #fff;
    }
    .title-group p {
      font-size: 0.84rem;
      color: #9da3b4;
    }
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      padding: 4px 12px;
      border-radius: 999px;
      background: rgba(143, 196, 162, 0.12);
      border: 1px solid rgba(143, 196, 162, 0.35);
      color: #8fc4a2;
      font-size: 0.78rem;
      font-weight: 600;
      letter-spacing: 0.02em;
      margin-bottom: 24px;
    }
    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #8fc4a2;
      box-shadow: 0 0 10px #8fc4a2;
      animation: pulse 2s infinite ease-in-out;
    }
    @keyframes pulse {
      0%, 100% { opacity: 0.6; transform: scale(0.9); }
      50% { opacity: 1; transform: scale(1.2); }
    }
    .metrics {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 24px;
    }
    .metric {
      background: rgba(11, 16, 32, 0.6);
      border: 1px solid rgba(244, 236, 220, 0.08);
      border-radius: 12px;
      padding: 14px 16px;
    }
    .metric-label {
      font-size: 0.74rem;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #7b8296;
      font-weight: 600;
    }
    .metric-val {
      font-size: 1.15rem;
      font-weight: 700;
      color: #f2a65a;
      margin-top: 4px;
    }
    .endpoints-title {
      font-size: 0.78rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #7b8296;
      font-weight: 600;
      margin-bottom: 10px;
    }
    .endpoint-list {
      display: grid;
      gap: 8px;
    }
    .endpoint-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: rgba(11, 16, 32, 0.4);
      border: 1px solid rgba(244, 236, 220, 0.06);
      border-radius: 10px;
      padding: 10px 14px;
      font-size: 0.82rem;
      text-decoration: none;
      color: #cfd3de;
      transition: all 180ms ease;
    }
    .endpoint-item:hover {
      background: rgba(242, 166, 90, 0.08);
      border-color: rgba(242, 166, 90, 0.3);
      color: #fff;
      transform: translateY(-1px);
    }
    .endpoint-tag {
      font-family: monospace;
      font-size: 0.76rem;
      background: rgba(244, 236, 220, 0.08);
      padding: 2px 7px;
      border-radius: 6px;
      color: #f2a65a;
    }
    .footer {
      margin-top: 24px;
      padding-top: 18px;
      border-top: 1px solid rgba(244, 236, 220, 0.08);
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.74rem;
      color: #6d7386;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="logo">
        <svg width="26" height="26" viewBox="0 0 32 32" fill="none">
          <rect x="1.4" y="1.4" width="29.2" height="29.2" rx="8.6" stroke="currentColor" stroke-opacity=".55" stroke-width="1.4"/>
          <path d="M13.5 9.5v13l9.5-6.5z" fill="#f2a65a"/>
          <path d="M8 11.5v9" stroke="#ef7b6a" stroke-linecap="round" stroke-width="2.2"/>
        </svg>
      </div>
      <div class="title-group">
        <h1>WatchAlong Server</h1>
        <p>Real-Time Watch Party Backend · Node.js & Socket.IO</p>
      </div>
    </div>

    <div class="status-badge">
      <span class="status-dot"></span>
      <span>System Operational · WebSocket Ready</span>
    </div>

    <div class="metrics">
      <div class="metric">
        <div class="metric-label">Uptime</div>
        <div class="metric-val">${formatUptime(uptime)}</div>
      </div>
      <div class="metric">
        <div class="metric-label">Active Rooms</div>
        <div class="metric-val">${rooms}</div>
      </div>
    </div>

    <div class="endpoints-title">Available Endpoints</div>
    <div class="endpoint-list">
      <a href="/health" class="endpoint-item">
        <span>Health Status</span>
        <span class="endpoint-tag">GET /health</span>
      </a>
      <div class="endpoint-item">
        <span>WebSocket Server</span>
        <span class="endpoint-tag">WSS /socket.io/</span>
      </div>
      <div class="endpoint-item">
        <span>Room Lookup</span>
        <span class="endpoint-tag">GET /api/rooms/:id</span>
      </div>
      <div class="endpoint-item">
        <span>Authentication API</span>
        <span class="endpoint-tag">POST /api/auth/*</span>
      </div>
    </div>

    <div class="footer">
      <span>WatchAlong Watch Party Platform</span>
      <span>v1.0.0</span>
    </div>
  </div>
</body>
</html>`;
      return res.type('html').send(html);
    }

    res.json({
      name: 'WatchAlong Real-Time Watch Party Server',
      status: 'ok',
      version: '1.0.0',
      uptimeSeconds: Math.round(process.uptime()),
      rooms: roomService.store ? roomService.store.size : 0,
      endpoints: {
        health: '/health',
        realtime: '/socket.io/',
        rooms: '/api/rooms/:roomId',
        auth: '/api/auth/'
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

