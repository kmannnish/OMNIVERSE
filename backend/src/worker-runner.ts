import { createMediaWorker } from './workers/media.worker.js';
import { startPeriodicCleanupWorker } from './workers/cleanup.worker.js';
import { initializeBucket } from './lib/s3.js';
import { redisClient } from './lib/redis.js';

async function bootstrapWorker() {
  console.log('⚡ Initializing Distributed Media Transcoder Worker...');

  try {
    // 1. Verify S3 bucket access
    await initializeBucket();

    // 2. Start BullMQ Media Processing Worker
    const mediaWorker = createMediaWorker();

    // 3. Start Periodic Cleanup Sweeper (local scratch + S3 retention)
    const cleanupInterval = startPeriodicCleanupWorker(60 * 60 * 1000); // 1 hour

    console.log('✅ Worker engine is active and ready for jobs.');

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      console.log(`\n[Worker] Received ${signal}. Draining queue and shutting down...`);
      clearInterval(cleanupInterval);
      await mediaWorker.close();
      await redisClient.quit();
      console.log('[Worker] Graceful shutdown complete.');
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (err) {
    console.error('❌ Failed to bootstrap media worker:', err);
    process.exit(1);
  }
}

bootstrapWorker();
