
const DEFAULT_DEV_ORIGINS = 'http://localhost:5173,http://127.0.0.1:5173';

export function loadConfig(env = process.env) {
  return {
    port: Number(env.PORT) || 4000,

    clientOrigins: (env.CLIENT_ORIGINS || DEFAULT_DEV_ORIGINS)
      .split(',')
      .map((origin) => origin.trim().replace(/\/$/, ''))
      .filter(Boolean),
    limits: {
      maxDisplayNameLength: 32,
      maxParticipantsPerRoom: 30,
      maxSeekSeconds: 60 * 60 * 24,

      reconnectGraceMs: Number(env.RECONNECT_GRACE_MS) || 45_000,
    },
    auth: {

      required: env.REQUIRE_AUTH !== 'false',

      hostRequiresAccount: env.ALLOW_GUEST_HOSTING !== 'true',
    },
    rateLimit: {

      capacity: 40,
      refillPerSecond: 8,
    },
  };
}

