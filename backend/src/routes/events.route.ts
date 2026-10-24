import type { FastifyPluginAsync } from 'fastify';
import { mediaQueue, subscribeToJobEvents } from '../lib/queue.js';
import type { JobProgressEvent, JobState } from '@media-suite/shared';

export const eventsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Params: { jobId: string } }>('/api/jobs/:jobId/events', async (request, reply) => {
    const { jobId } = request.params;

    // Set standard SSE streaming headers
    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache, no-transform');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.setHeader('X-Accel-Buffering', 'no'); // Prevent Nginx/reverse-proxy buffering
    reply.raw.setHeader('Access-Control-Allow-Origin', '*');
    reply.raw.flushHeaders();

    const sendSseMessage = (event: string, data: unknown) => {
      const json = JSON.stringify(data);
      reply.raw.write(`event: ${event}\ndata: ${json}\n\n`);
      reply.raw.write(`data: ${json}\n\n`);
    };

    // 1. Send initial current state if job already exists in BullMQ
    try {
      const job = await mediaQueue.getJob(jobId);
      if (job) {
        const state = await job.getState();
        const progress = typeof job.progress === 'number' ? job.progress : 0;
        let normalizedState: JobState = 'queued';
        if (state === 'active') normalizedState = progress >= 88 ? 'uploading' : 'processing';
        else if (state === 'completed') normalizedState = 'completed';
        else if (state === 'failed') normalizedState = 'failed';

        const initialEvent: JobProgressEvent = {
          jobId,
          state: normalizedState,
          progress,
          stage:
            normalizedState === 'completed'
              ? 'Ready for high-speed download'
              : normalizedState === 'uploading'
              ? 'Uploading to S3...'
              : 'Processing media...',
          result: job.returnvalue || undefined,
          error: job.failedReason ? { code: 'JOB_FAILED', message: job.failedReason } : undefined,
          timestamp: new Date().toISOString(),
        };

        sendSseMessage('progress', initialEvent);

        if (normalizedState === 'completed' || normalizedState === 'failed') {
          reply.raw.end();
          return;
        }
      }
    } catch (err) {
      fastify.log.warn({ err, jobId }, '[SSE] Error querying initial job state');
    }

    // 2. Subscribe to Redis Pub/Sub for live real-time updates
    const subscription = subscribeToJobEvents(jobId, (event) => {
      sendSseMessage('progress', event);

      // Close stream once job reaches a terminal state
      if (event.state === 'completed' || event.state === 'failed') {
        setTimeout(() => {
          try {
            reply.raw.end();
          } catch {
            // Socket might already be closed
          }
        }, 500);
      }
    });

    // 3. Heartbeat / Keep-Alive timer to prevent socket drops through firewalls & proxies
    const heartbeatTimer = setInterval(() => {
      try {
        reply.raw.write(': ping\n\n');
      } catch {
        clearInterval(heartbeatTimer);
      }
    }, 15000);

    // 4. Handle client disconnection cleanly
    request.raw.on('close', async () => {
      clearInterval(heartbeatTimer);
      await subscription.unsubscribe();
      fastify.log.debug(`[SSE] Client disconnected from job stream: ${jobId}`);
    });
  });
};
