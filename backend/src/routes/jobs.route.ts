import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import crypto from 'node:crypto';
import type { Readable } from 'node:stream';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { mediaQueue, publishJobProgress } from '../lib/queue.js';
import { validateMediaUrl, SsrfSecurityError } from '../lib/ssrf.js';
import { isStreamingPortalUrl } from '../media/ytdlp.service.js';
import { s3Client } from '../lib/s3.js';
import { env } from '../config/env.js';
import type {
  CreateJobResponse,
  JobStatusResponse,
  TargetFormat,
  TargetQuality,
  JobState,
} from '@media-suite/shared';

const TargetFormatSchema = z.enum(['mp4', 'webm', 'mp3', 'm4a', 'wav', 'srt', 'vtt']);
const TargetQualitySchema = z.enum(['original', '4k', '1440p', '1080p', '720p', '480p', '360p', '240p']).optional();

const CreateJobSchema = z.object({
  sourceUrl: z.string().min(1, 'Source URL is required'),
  targetFormat: TargetFormatSchema,
  targetQuality: TargetQualitySchema,
  extractSubtitleTrackIndex: z.number().int().nonnegative().optional(),
  customFilename: z.string().max(120).optional(),
});

export const jobRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/jobs: Enqueues media transcoding task (Sub-100ms response time)
  fastify.post<{ Body: z.infer<typeof CreateJobSchema> }>('/api/jobs', async (request, reply) => {
    const parseResult = CreateJobSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parseResult.error.errors.map((e) => e.message).join(', '),
        },
      });
    }

    const { sourceUrl, targetFormat, targetQuality, extractSubtitleTrackIndex, customFilename } =
      parseResult.data;

    try {
      let finalUrl = sourceUrl;
      // If NOT a portal URL, validate SSRF
      if (!isStreamingPortalUrl(sourceUrl)) {
        const validatedUrl = await validateMediaUrl(sourceUrl);
        finalUrl = validatedUrl.toString();
      }

      const jobId = crypto.randomUUID();
      const createdAt = new Date().toISOString();

      // Add to BullMQ Queue
      await mediaQueue.add(
        'transcode',
        {
          jobId,
          sourceUrl: finalUrl,
          targetFormat,
          targetQuality,
          extractSubtitleTrackIndex,
          customFilename,
          createdAt,
        },
        {
          jobId,
        }
      );

      // Emit initial 'queued' event for immediate SSE consumers
      await publishJobProgress({
        jobId,
        state: 'queued',
        progress: 0,
        stage: 'Job queued in processing pipeline',
        timestamp: createdAt,
      });

      return reply.status(202).send({
        success: true,
        jobId,
        status: 'queued',
        createdAt,
      } satisfies CreateJobResponse);
    } catch (err: unknown) {
      if (err instanceof SsrfSecurityError) {
        return reply.status(403).send({
          success: false,
          error: {
            code: err.code,
            message: `SSRF Security Policy: ${err.message}`,
          },
        });
      }

      fastify.log.error(err, '[Job Creation Error]');
      return reply.status(500).send({
        success: false,
        error: {
          code: 'ENQUEUE_FAILED',
          message: 'Failed to enqueue processing job.',
        },
      });
    }
  });

  // GET /api/jobs/:jobId: Queries instantaneous state of a BullMQ job
  fastify.get<{ Params: { jobId: string } }>('/api/jobs/:jobId', async (request, reply) => {
    const { jobId } = request.params;
    const job = await mediaQueue.getJob(jobId);

    if (!job) {
      return reply.status(404).send({
        success: false,
        error: {
          code: 'JOB_NOT_FOUND',
          message: `Job ${jobId} was not found or has expired.`,
        },
      });
    }

    const state = await job.getState();
    const progress = typeof job.progress === 'number' ? job.progress : 0;

    let normalizedState: JobState = 'queued';
    if (state === 'active') normalizedState = progress >= 88 ? 'uploading' : 'processing';
    else if (state === 'completed') normalizedState = 'completed';
    else if (state === 'failed') normalizedState = 'failed';

    return reply.status(200).send({
      jobId,
      state: normalizedState,
      progress,
      createdAt: new Date(job.timestamp).toISOString(),
      result: job.returnvalue || undefined,
      error: job.failedReason
        ? {
            code: 'JOB_FAILED',
            message: job.failedReason,
          }
        : undefined,
    } satisfies JobStatusResponse);
  });

  // GET /api/jobs/:jobId/download: Universal high-speed download proxy (LAN, Tailscale, Funnel & Localhost)
  fastify.get<{ Params: { jobId: string } }>('/api/jobs/:jobId/download', async (request, reply) => {
    const { jobId } = request.params;
    const job = await mediaQueue.getJob(jobId);

    if (!job || !job.returnvalue?.filename) {
      return reply.status(404).send({
        success: false,
        error: {
          code: 'DOWNLOAD_NOT_READY',
          message: `The manifestation job ${jobId} is still processing or has expired.`,
        },
      });
    }

    const result = job.returnvalue;
    const datePrefix = new Date(job.timestamp).toISOString().slice(0, 10);
    const s3Key = `exports/${datePrefix}/${jobId}/${result.filename}`;

    try {
      const getObj = await s3Client.send(
        new GetObjectCommand({
          Bucket: env.S3_BUCKET,
          Key: s3Key,
        })
      );

      const asciiFilename = result.filename.replace(/["\r\n\t]/g, '_').replace(/[^a-zA-Z0-9._\-[\]]/g, '_');
      reply.header('Content-Type', result.mimeType || 'application/octet-stream');
      if (result.fileSize) reply.header('Content-Length', result.fileSize);
      reply.header(
        'Content-Disposition',
        `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodeURIComponent(result.filename)}`
      );

      return reply.send(getObj.Body as Readable);
    } catch (s3Err) {
      fastify.log.warn({ s3Err, jobId }, '[Download Proxy] Direct S3 stream failed, falling back to presigned URL');
      if (result.downloadUrl) {
        return reply.redirect(result.downloadUrl);
      }
      return reply.status(500).send({
        success: false,
        error: {
          code: 'S3_FETCH_FAILED',
          message: 'Unable to retrieve media from storage.',
        },
      });
    }
  });
};
