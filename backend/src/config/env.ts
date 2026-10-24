import dotenv from 'dotenv';
import path from 'node:path';
import os from 'node:os';
import { z } from 'zod';

dotenv.config();

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  HOST: z.string().default('0.0.0.0'),
  CORS_ORIGIN: z.string().default('*'),

  // Redis configuration
  REDIS_HOST: z.string().default('127.0.0.1'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional().default(''),
  REDIS_DB: z.coerce.number().default(0),

  // S3 / MinIO Configuration
  S3_ENDPOINT: z.string().default('http://127.0.0.1:9000'),
  S3_REGION: z.string().default('us-east-1'),
  S3_ACCESS_KEY_ID: z.string().default('minioadmin'),
  S3_SECRET_ACCESS_KEY: z.string().default('minioadmin'),
  S3_BUCKET: z.string().default('media-storage'),
  S3_FORCE_PATH_STYLE: z.preprocess((val) => val === 'true' || val === true || val === '1', z.boolean()).default(true),
  S3_PUBLIC_URL: z.string().optional(), // Public endpoint for browser pre-signed downloads if different from internal docker S3_ENDPOINT

  // Media & Binary paths
  FFMPEG_PATH: z.string().default('ffmpeg'),
  FFPROBE_PATH: z.string().default('ffprobe'),
  SCRATCH_DIR: z.string().default(path.join(os.tmpdir(), 'media-transcoder-scratch')),

  // Job & Retention Settings
  JOB_TIMEOUT_MS: z.coerce.number().default(30 * 60 * 1000), // 30 minutes
  PRESIGNED_EXPIRATION_SECONDS: z.coerce.number().default(24 * 3600), // 24 hours
  RETENTION_HOURS: z.coerce.number().default(24),
  CLEANUP_CRON: z.string().default('0 * * * *'), // Every hour
});

export type Env = z.infer<typeof EnvSchema>;

function parseEnv(): Env {
  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    console.error('❌ Invalid environment variables:', JSON.stringify(result.error.format(), null, 2));
    throw new Error('Environment configuration error');
  }
  return result.data;
}

export const env = parseEnv();
