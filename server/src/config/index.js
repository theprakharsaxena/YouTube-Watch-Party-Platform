// All tunable server settings live here. Deployment values come from env vars.

const DEFAULT_DEV_ORIGINS = 'http://localhost:5173,http://127.0.0.1:5173';

export function loadConfig(env = process.env) {
  return {
    port: Number(env.PORT) || 4000,
    // Comma-separated list of exact browser origins allowed by CORS / Socket.IO.
    clientOrigins: (env.CLIENT_ORIGINS || DEFAULT_DEV_ORIGINS)
      .split(',')
      .map((origin) => origin.trim().replace(/\/$/, ''))
      .filter(Boolean),
    limits: {
      maxDisplayNameLength: 24,
      maxParticipantsPerRoom: 30,
      maxSeekSeconds: 60 * 60 * 24, // 24h sanity cap; YouTube duration is not known server-side
      // How long a disconnected participant keeps their seat (and role) for a reconnect.
      reconnectGraceMs: Number(env.RECONNECT_GRACE_MS) || 45_000,
    },
    rateLimit: {
      // Per-socket token bucket applied to every client event.
      capacity: 40,
      refillPerSecond: 8,
    },
  };
}
