import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

export async function setupRedisAdapter(io, { redisUrl = process.env.REDIS_URL } = {}) {
  if (!redisUrl) {
    return {
      enabled: false,
      mode: 'in-memory',
      message: 'Running in standalone in-memory mode. Set REDIS_URL to enable multi-server cluster.',
    };
  }

  try {
    const pubClient = createClient({ url: redisUrl });
    const subClient = pubClient.duplicate();

    pubClient.on('error', (err) => console.error('[Redis Pub] Error:', err.message));
    subClient.on('error', (err) => console.error('[Redis Sub] Error:', err.message));

    await Promise.all([pubClient.connect(), subClient.connect()]);

    io.adapter(createAdapter(pubClient, subClient));
    console.info('[Redis Adapter] Connected successfully. Multi-instance cluster sync active.');

    return {
      enabled: true,
      mode: 'redis-pubsub',
      pubClient,
      subClient,
    };
  } catch (error) {
    console.warn('[Redis Adapter] Failed to connect to Redis. Falling back to in-memory adapter:', error.message);
    return {
      enabled: false,
      mode: 'fallback-in-memory',
      error: error.message,
    };
  }
}

