import { Redis, type RedisOptions } from 'ioredis';
import { env } from '../config/env.js';

const redisConfig: RedisOptions = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD || undefined,
  db: env.REDIS_DB,
  maxRetriesPerRequest: null, // Required by BullMQ
  enableReadyCheck: false,
  retryStrategy(times) {
    const delay = Math.min(times * 100, 3000);
    return delay;
  },
};

/**
 * Shared primary Redis connection for queues and commands
 */
export const redisClient = new Redis(redisConfig);

/**
 * Factory for creating fresh Redis instances (e.g. dedicated subscriber for PubSub)
 */
export function createRedisInstance(): Redis {
  return new Redis(redisConfig);
}

export const redisPublisher = new Redis(redisConfig);

redisClient.on('error', (err) => {
  console.error('[Redis Client Error]', err.message);
});

redisPublisher.on('error', (err) => {
  console.error('[Redis Publisher Error]', err.message);
});
