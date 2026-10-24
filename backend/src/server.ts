import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import { spawnSync } from 'node:child_process';
import { env } from './config/env.js';
import { redisClient } from './lib/redis.js';
import { initializeBucket } from './lib/s3.js';
import { inspectRoutes } from './routes/inspect.route.js';
import { jobRoutes } from './routes/jobs.route.js';
import { eventsRoutes } from './routes/events.route.js';

export async function buildServer() {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === 'production' ? 'info' : 'debug',
      transport:
        env.NODE_ENV !== 'production'
          ? {
              target: 'pino-pretty',
              options: { colorize: true },
            }
          : undefined,
    },
    disableRequestLogging: env.NODE_ENV === 'production',
  });

  // Plugins
  await app.register(cors, {
    origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(','),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  });

  await app.register(sensible);

  // Health Check Endpoint
  app.get('/health', async (_request, reply) => {
    let redisOk = false;
    try {
      const pingRes = await redisClient.ping();
      redisOk = pingRes === 'PONG';
    } catch {
      redisOk = false;
    }

    const ffmpegCheck = spawnSync(env.FFMPEG_PATH, ['-version']);
    const ffprobeCheck = spawnSync(env.FFPROBE_PATH, ['-version']);
    const ffmpegOk = ffmpegCheck.status === 0;
    const ffprobeOk = ffprobeCheck.status === 0;

    const allHealthy = redisOk && ffmpegOk && ffprobeOk;

    return reply.status(allHealthy ? 200 : 503).send({
      status: allHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      services: {
        redis: redisOk ? 'up' : 'down',
        ffmpeg: ffmpegOk ? 'available' : 'unavailable',
        ffprobe: ffprobeOk ? 'available' : 'unavailable',
      },
    });
  });

  // API Routes
  await app.register(inspectRoutes);
  await app.register(jobRoutes);
  await app.register(eventsRoutes);

  return app;
}

async function start() {
  const app = await buildServer();

  try {
    // Ensure S3 storage bucket exists
    await initializeBucket();

    await app.listen({
      port: env.PORT,
      host: env.HOST,
    });

    console.log(`🚀 Media Transcoder Backend running at http://${env.HOST}:${env.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  // Graceful shutdown
  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
  for (const signal of signals) {
    process.on(signal, async () => {
      console.log(`\nReceived ${signal}. Shutting down gracefully...`);
      await app.close();
      await redisClient.quit();
      process.exit(0);
    });
  }
}

// Start if executed directly
if (process.argv[1]?.endsWith('server.ts') || process.argv[1]?.endsWith('server.js')) {
  start();
}
