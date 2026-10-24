import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { validateMediaUrl, SsrfSecurityError } from '../lib/ssrf.js';
import { probeMedia, FfprobeError } from '../media/ffprobe.service.js';
import { isStreamingPortalUrl, probeStreamingPortal, YtDlpError } from '../media/ytdlp.service.js';
import type { InspectMediaResponse } from '@media-suite/shared';

const InspectSchema = z.object({
  url: z.string().min(1, 'Media URL is required'),
});

export const inspectRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: { url: string } }>('/api/inspect', async (request, reply) => {
    const parseResult = InspectSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parseResult.error.errors.map((e) => e.message).join(', '),
        },
      } satisfies InspectMediaResponse);
    }

    const { url } = parseResult.data;

    try {
      // 1. If user supplied a streaming portal link (YouTube, Vimeo, etc.), use yt-dlp metadata probe
      if (isStreamingPortalUrl(url)) {
        fastify.log.info({ url }, '[Inspect] Streaming portal URL detected. Probing via yt-dlp...');
        const portalMetadata = await probeStreamingPortal(url);
        return reply.status(200).send({
          success: true,
          data: portalMetadata,
        } satisfies InspectMediaResponse);
      }

      // 2. Direct media links: Enforce strict SSRF protection
      const validatedUrl = await validateMediaUrl(url);

      // 3. Asynchronous FFprobe Probing
      const metadata = await probeMedia(validatedUrl.toString());

      return reply.status(200).send({
        success: true,
        data: metadata,
      } satisfies InspectMediaResponse);
    } catch (err: unknown) {
      if (err instanceof YtDlpError) {
        fastify.log.warn({ err, url }, '[Inspect Error] yt-dlp extraction failed');
        return reply.status(422).send({
          success: false,
          error: {
            code: err.code,
            message: err.message,
          },
        } satisfies InspectMediaResponse);
      }

      if (err instanceof SsrfSecurityError) {
        fastify.log.warn({ err, url }, `[SSRF Blocked] Request denied for URL: ${url}`);
        return reply.status(403).send({
          success: false,
          error: {
            code: err.code,
            message: `SSRF Security Policy: ${err.message}`,
          },
        } satisfies InspectMediaResponse);
      }

      if (err instanceof FfprobeError) {
        fastify.log.error({ err, url }, '[Inspect Error] FFprobe failed');
        return reply.status(422).send({
          success: false,
          error: {
            code: err.code,
            message: err.message,
          },
        } satisfies InspectMediaResponse);
      }

      fastify.log.error(err, '[Inspect Error] Internal failure');
      return reply.status(500).send({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred while inspecting media format.',
        },
      } satisfies InspectMediaResponse);
    }
  });
};
