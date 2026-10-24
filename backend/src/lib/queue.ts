import { Queue, type JobsOptions } from 'bullmq';
import { redisClient, redisPublisher, createRedisInstance } from './redis.js';
import type {
  CreateJobRequest,
  JobProgressEvent,
  JobState,
  TargetFormat,
  TargetQuality,
} from '@media-suite/shared';

export const MEDIA_QUEUE_NAME = 'media-processing';
export const CLEANUP_QUEUE_NAME = 'media-cleanup';

export interface MediaJobData {
  jobId: string;
  sourceUrl: string;
  targetFormat: TargetFormat;
  targetQuality?: TargetQuality;
  extractSubtitleTrackIndex?: number;
  customFilename?: string;
  createdAt: string;
}

export const defaultJobOptions: JobsOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000,
  },
  removeOnComplete: {
    age: 3600, // keep 1 hour
    count: 1000,
  },
  removeOnFail: {
    age: 86400, // keep 24 hours
    count: 1000,
  },
};

/**
 * BullMQ Queue for processing media jobs
 */
export const mediaQueue = new Queue<MediaJobData>(MEDIA_QUEUE_NAME, {
  connection: redisClient,
  defaultJobOptions,
});

/**
 * BullMQ Queue for scheduled cleanup jobs
 */
export const cleanupQueue = new Queue(CLEANUP_QUEUE_NAME, {
  connection: redisClient,
});

/**
 * Publishes a real-time job progress event to Redis Pub/Sub channel
 */
export async function publishJobProgress(event: JobProgressEvent): Promise<void> {
  const channel = `job-events:${event.jobId}`;
  try {
    await redisPublisher.publish(channel, JSON.stringify(event));
  } catch (err) {
    console.error(`[Queue] Failed to publish event to channel ${channel}:`, err);
  }
}

/**
 * Subscribes to real-time events for a specific job ID
 */
export function subscribeToJobEvents(
  jobId: string,
  onEvent: (event: JobProgressEvent) => void
): { unsubscribe: () => Promise<void> } {
  const channel = `job-events:${jobId}`;
  const subscriber = createRedisInstance();

  subscriber.subscribe(channel, (err) => {
    if (err) {
      console.error(`[Queue] Failed to subscribe to ${channel}:`, err);
    }
  });

  subscriber.on('message', (chan, message) => {
    if (chan === channel) {
      try {
        const parsed = JSON.parse(message) as JobProgressEvent;
        onEvent(parsed);
      } catch (err) {
        console.error(`[Queue] Malformed message received on ${chan}:`, err);
      }
    }
  });

  return {
    unsubscribe: async () => {
      try {
        await subscriber.unsubscribe(channel);
        subscriber.disconnect();
      } catch (err) {
        console.warn(`[Queue] Error during unsubscribe for ${channel}:`, err);
      }
    },
  };
}
