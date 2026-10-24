import { Worker, type Job } from 'bullmq';
import path from 'node:path';
import fs from 'node:fs';
import { redisClient } from '../lib/redis.js';
import {
  MEDIA_QUEUE_NAME,
  type MediaJobData,
  publishJobProgress,
} from '../lib/queue.js';
import { probeMedia } from '../media/ffprobe.service.js';
import { executeFfmpegTranscode, planTranscode, FfmpegError } from '../media/ffmpeg.service.js';
import {
  isStreamingPortalUrl,
  probeStreamingPortal,
  downloadPortalMedia,
  YtDlpError,
} from '../media/ytdlp.service.js';
import { uploadStreamToS3, generatePresignedDownloadUrl } from '../lib/s3.js';
import { env } from '../config/env.js';
import type { JobProgressEvent, JobResultDetails, TargetFormat, TargetQuality } from '@media-suite/shared';

// Ensure scratch directory exists on worker initialization
if (!fs.existsSync(env.SCRATCH_DIR)) {
  fs.mkdirSync(env.SCRATCH_DIR, { recursive: true });
}

const FORMAT_EXT_MAP: Record<TargetFormat, { ext: string; mime: string }> = {
  mp4: { ext: '.mp4', mime: 'video/mp4' },
  webm: { ext: '.webm', mime: 'video/webm' },
  mp3: { ext: '.mp3', mime: 'audio/mpeg' },
  m4a: { ext: '.m4a', mime: 'audio/mp4' },
  wav: { ext: '.wav', mime: 'audio/wav' },
  srt: { ext: '.srt', mime: 'application/x-subrip' },
  vtt: { ext: '.vtt', mime: 'text/vtt' },
};

/**
 * Generates a clean filename suffix based on chosen format and quality.
 * e.g., _[1080p], _[4K], _[320kbps], _[source]
 */
export function buildQualitySuffix(targetFormat: TargetFormat, targetQuality?: TargetQuality): string {
  if (targetFormat === 'mp3') return '_[320kbps]';
  if (targetFormat === 'm4a') return '_[256kbps]';
  if (targetFormat === 'wav') return '_[lossless]';
  if (targetFormat === 'srt') return '_[subtitles]';
  if (targetFormat === 'vtt') return '_[subtitles]';

  switch (targetQuality) {
    case '4k':
      return '_[4K]';
    case '1440p':
      return '_[1440p]';
    case '1080p':
      return '_[1080p]';
    case '720p':
      return '_[720p]';
    case '480p':
      return '_[480p]';
    case '360p':
      return '_[360p]';
    case '240p':
      return '_[240p]';
    case 'original':
    default:
      return '_[source]';
  }
}

/**
 * Creates a sanitized output filename including the quality/format suffix and correct extension.
 */
export function generateOutputFilename(
  rawTitle: string,
  targetFormat: TargetFormat,
  targetQuality?: TargetQuality
): string {
  const formatInfo = FORMAT_EXT_MAP[targetFormat];
  // Strip any existing file extension (.mp4, .webm, .mkv, .mp3, etc.)
  const withoutExt = rawTitle.replace(/\.[a-zA-Z0-9]{2,5}$/, '');

  let cleanBase = withoutExt
    .replace(/[^\w.\-[\]]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);

  if (!cleanBase) {
    cleanBase = 'media';
  }

  const suffix = buildQualitySuffix(targetFormat, targetQuality);

  // Avoid duplicate suffix if filename already ends with it
  if (cleanBase.toLowerCase().endsWith(suffix.toLowerCase())) {
    return `${cleanBase}${formatInfo.ext}`;
  }

  return `${cleanBase}${suffix}${formatInfo.ext}`;
}

export function createMediaWorker(): Worker<MediaJobData, JobResultDetails> {
  const worker = new Worker<MediaJobData, JobResultDetails>(
    MEDIA_QUEUE_NAME,
    async (job: Job<MediaJobData>) => {
      const { jobId, sourceUrl, targetFormat, targetQuality, extractSubtitleTrackIndex, customFilename } = job.data;
      let tempOutputPath: string | null = null;

      try {
        console.log(`[Worker] Started processing job ${jobId} (format: ${targetFormat}, quality: ${targetQuality || 'original'})`);
        const isPortal = isStreamingPortalUrl(sourceUrl);
        const formatInfo = FORMAT_EXT_MAP[targetFormat];

        // Stage 1: Probing & Planning
        await publishJobProgress({
          jobId,
          state: 'processing',
          progress: 5,
          stage: isPortal ? 'Analyzing streaming media manifest...' : 'Probing stream metadata...',
          timestamp: new Date().toISOString(),
        });
        await job.updateProgress(5);

        let finalFilename: string;
        let mimeType = formatInfo.mime;
        let durationSeconds = 0;
        let isStreamCopy = false;

        if (isPortal) {
          // --- Streaming Portal Pipeline (YouTube / Vimeo / etc.) ---
          const portalMeta = await probeStreamingPortal(sourceUrl);
          durationSeconds = portalMeta.duration;
          finalFilename = generateOutputFilename(
            customFilename || portalMeta.filename || 'media',
            targetFormat,
            targetQuality
          );
          tempOutputPath = path.join(env.SCRATCH_DIR, `${jobId}-${Date.now()}${formatInfo.ext}`);

          await publishJobProgress({
            jobId,
            state: 'processing',
            progress: 10,
            stage: 'Downloading and muxing video streams...',
            timestamp: new Date().toISOString(),
          });
          await job.updateProgress(10);

          let lastReported = 10;
          await downloadPortalMedia({
            url: sourceUrl,
            outputPath: tempOutputPath,
            targetFormat,
            targetQuality,
            onProgress: async (percent, metrics) => {
              const scaled = Math.min(85, Math.max(10, Math.round(10 + percent * 0.75)));
              if (scaled > lastReported || percent === 100) {
                lastReported = scaled;
                await job.updateProgress(scaled);
                await publishJobProgress({
                  jobId,
                  state: 'processing',
                  progress: scaled,
                  stage: `Processing media (${percent}%)...`,
                  metrics,
                  timestamp: new Date().toISOString(),
                });
              }
            },
          });
        } else {
          // --- Direct Media File Pipeline (Self-hosted MP4 / WebM / S3 links) ---
          const metadata = await probeMedia(sourceUrl);
          durationSeconds = metadata.duration;
          const transcodePlan = planTranscode(metadata, targetFormat, targetQuality, extractSubtitleTrackIndex);
          isStreamCopy = transcodePlan.isVideoCopy && (transcodePlan.isAudioCopy || metadata.audioStreams.length === 0);
          mimeType = transcodePlan.mimeType;

          finalFilename = generateOutputFilename(
            customFilename || metadata.filename || 'media',
            targetFormat,
            targetQuality
          );
          tempOutputPath = path.join(env.SCRATCH_DIR, `${jobId}-${Date.now()}${formatInfo.ext}`);

          const stageMsg = isStreamCopy
            ? 'Fast stream copying / remuxing container (zero quality loss)...'
            : 'Transcoding media streams...';

          await publishJobProgress({
            jobId,
            state: 'processing',
            progress: 10,
            stage: stageMsg,
            timestamp: new Date().toISOString(),
          });
          await job.updateProgress(10);

          let lastReported = 10;
          await executeFfmpegTranscode({
            inputSource: sourceUrl,
            outputPath: tempOutputPath,
            metadata,
            targetFormat,
            targetQuality,
            extractSubtitleTrackIndex,
            onProgress: async (percent, metrics) => {
              const scaled = Math.min(85, Math.max(10, Math.round(10 + percent * 0.75)));
              if (scaled > lastReported || percent === 100) {
                lastReported = scaled;
                await job.updateProgress(scaled);
                await publishJobProgress({
                  jobId,
                  state: 'processing',
                  progress: scaled,
                  stage: stageMsg,
                  metrics,
                  timestamp: new Date().toISOString(),
                });
              }
            },
          });
        }

        // Stage 2: Direct Streaming S3 Multipart Upload
        await publishJobProgress({
          jobId,
          state: 'uploading',
          progress: 88,
          stage: 'Uploading processed file to high-speed cloud storage...',
          timestamp: new Date().toISOString(),
        });
        await job.updateProgress(88);

        // Find actual output file (yt-dlp may append extension)
        let actualFilePath = tempOutputPath;
        if (!fs.existsSync(actualFilePath)) {
          const files = await fs.promises.readdir(env.SCRATCH_DIR);
          const matched = files.find((f) => f.startsWith(jobId));
          if (matched) {
            actualFilePath = path.join(env.SCRATCH_DIR, matched);
          } else {
            throw new Error('Transcode completed but output file could not be located on disk.');
          }
        }

        const stat = await fs.promises.stat(actualFilePath);
        const s3Key = `exports/${new Date().toISOString().slice(0, 10)}/${jobId}/${finalFilename}`;
        const readStream = fs.createReadStream(actualFilePath);

        await uploadStreamToS3({
          key: s3Key,
          stream: readStream,
          contentType: mimeType,
          filename: finalFilename,
          onProgress: async (uploadPercent) => {
            const scaled = Math.min(98, Math.max(88, Math.round(88 + uploadPercent * 0.1)));
            await job.updateProgress(scaled);
            await publishJobProgress({
              jobId,
              state: 'uploading',
              progress: scaled,
              stage: `Uploading to S3 (${uploadPercent}%)...`,
              timestamp: new Date().toISOString(),
            });
          },
        });

        // Stage 3: Pre-signed Download URL Generation
        const downloadUrl = await generatePresignedDownloadUrl(s3Key, finalFilename);
        const expiresAt = new Date(Date.now() + env.PRESIGNED_EXPIRATION_SECONDS * 1000).toISOString();

        const resultDetails: JobResultDetails = {
          downloadUrl,
          filename: finalFilename,
          fileSize: stat.size,
          mimeType,
          durationSeconds,
          isStreamCopy,
          expiresAt,
        };

        // Stage 4: Immediate Scratch File Cleanup
        try {
          if (fs.existsSync(actualFilePath)) {
            await fs.promises.unlink(actualFilePath);
            console.log(`[Worker] Cleaned scratch file: ${actualFilePath}`);
          }
        } catch (cleanupErr) {
          console.warn(`[Worker] Failed to unlink scratch file:`, cleanupErr);
        }

        // Stage 5: Completion Event
        await publishJobProgress({
          jobId,
          state: 'completed',
          progress: 100,
          stage: 'Ready for high-speed download',
          result: resultDetails,
          timestamp: new Date().toISOString(),
        });
        await job.updateProgress(100);

        console.log(`[Worker] Job ${jobId} successfully completed!`);
        return resultDetails;
      } catch (error: unknown) {
        console.error(`[Worker] Job ${jobId} failed:`, error);

        if (tempOutputPath && fs.existsSync(tempOutputPath)) {
          await fs.promises.unlink(tempOutputPath).catch(() => {});
        }

        const isFfmpegErr = error instanceof FfmpegError;
        const isYtDlpErr = error instanceof YtDlpError;
        const errorCode = isFfmpegErr
          ? (error as FfmpegError).code
          : isYtDlpErr
          ? (error as YtDlpError).code
          : 'INTERNAL_WORKER_ERROR';
        const errorMessage = error instanceof Error ? error.message : String(error);

        await publishJobProgress({
          jobId,
          state: 'failed',
          progress: 0,
          stage: 'Processing failed',
          error: {
            code: errorCode,
            message: errorMessage,
            details: isFfmpegErr ? (error as FfmpegError).stderrOutput : undefined,
          },
          timestamp: new Date().toISOString(),
        });

        throw error;
      }
    },
    {
      connection: redisClient,
      concurrency: 2,
    }
  );

  worker.on('ready', () => {
    console.log(`[BullMQ Worker] Ready and listening for media jobs on queue '${MEDIA_QUEUE_NAME}'`);
  });

  worker.on('error', (err) => {
    console.error('[BullMQ Worker] Unhandled worker error:', err);
  });

  return worker;
}
