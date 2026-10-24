import {
  S3Client,
  HeadBucketCommand,
  CreateBucketCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
  type _Object,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Upload } from '@aws-sdk/lib-storage';
import type { Readable } from 'node:stream';
import { env } from '../config/env.js';

export const s3Client = new S3Client({
  endpoint: env.S3_ENDPOINT,
  region: env.S3_REGION,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  },
  forcePathStyle: env.S3_FORCE_PATH_STYLE,
});

/**
 * Initializes the default S3 / MinIO bucket if it does not already exist.
 */
export async function initializeBucket(retries: number = 5): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await s3Client.send(new HeadBucketCommand({ Bucket: env.S3_BUCKET }));
      console.log(`[S3] Verified existing bucket: '${env.S3_BUCKET}'`);
      return;
    } catch (err: unknown) {
      const errorName = (err as { name?: string })?.name;
      const statusCode = (err as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;

      if (errorName === 'NotFound' || statusCode === 404 || errorName === 'NoSuchBucket') {
        console.log(`[S3] Bucket '${env.S3_BUCKET}' not found (attempt ${attempt}/${retries}). Creating...`);
        try {
          await s3Client.send(new CreateBucketCommand({ Bucket: env.S3_BUCKET }));
          console.log(`[S3] Successfully created bucket: '${env.S3_BUCKET}'`);
          return;
        } catch (createErr) {
          console.warn(`[S3] CreateBucket warning (attempt ${attempt}/${retries}):`, (createErr as Error).message);
        }
      } else {
        console.warn(`[S3] HeadBucket attempt ${attempt}/${retries} for '${env.S3_BUCKET}':`, (err as Error).message);
      }

      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
  }
  console.warn(`[S3] Warning: Proceeding without confirmed bucket verification for '${env.S3_BUCKET}'.`);
}

export interface UploadStreamOptions {
  key: string;
  stream: Readable;
  contentType: string;
  filename: string;
  onProgress?: (percentage: number) => void;
}

/**
 * Uploads a readable stream directly to S3 using managed multipart chunking.
 */
export async function uploadStreamToS3(options: UploadStreamOptions): Promise<{ key: string; location?: string }> {
  const { key, stream, contentType, filename, onProgress } = options;

  try {
    await initializeBucket();
  } catch (bucketErr) {
    console.warn('[S3] Auto-init bucket warning:', (bucketErr as Error).message);
  }

  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: env.S3_BUCKET,
      Key: key,
      Body: stream,
      ContentType: contentType,
      ContentDisposition: `attachment; filename="${(filename || 'media').replace(/["\r\n\t]/g, '_').replace(/[^a-zA-Z0-9._\-[\]]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(filename || 'media')}`,
    },
    queueSize: 4, // 4 concurrent part uploads
    partSize: 10 * 1024 * 1024, // 10MB chunk size
    leavePartsOnError: false,
  });

  if (onProgress) {
    upload.on('httpUploadProgress', (progress) => {
      if (progress.total && progress.loaded) {
        const percent = Math.min(100, Math.round((progress.loaded / progress.total) * 100));
        onProgress(percent);
      }
    });
  }

  const result = await upload.done();
  return { key, location: result.Location };
}

/**
 * Generates an authorized pre-signed download URL with ResponseContentDisposition set.
 */
export async function generatePresignedDownloadUrl(
  key: string,
  downloadFilename: string,
  expiresInSeconds: number = env.PRESIGNED_EXPIRATION_SECONDS
): Promise<string> {
  const sanitizedFilename = downloadFilename.replace(/["\r\n\t]/g, '_');
  const asciiFilename = sanitizedFilename.replace(/[^a-zA-Z0-9._\-[\]]/g, '_');
  const command = new GetObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: key,
    ResponseContentDisposition: `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodeURIComponent(sanitizedFilename)}`,
  });

  let signedUrl = await getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });

  // If S3_PUBLIC_URL is configured (e.g. MinIO accessible via localhost outside Docker container),
  // replace the internal container host with the public host.
  if (env.S3_PUBLIC_URL && env.S3_ENDPOINT !== env.S3_PUBLIC_URL) {
    const s3Url = new URL(env.S3_ENDPOINT);
    const pubUrl = new URL(env.S3_PUBLIC_URL);
    signedUrl = signedUrl.replace(`${s3Url.protocol}//${s3Url.host}`, `${pubUrl.protocol}//${pubUrl.host}`);
  }

  return signedUrl;
}

/**
 * Sweeper function to delete S3 objects older than specified hours.
 */
export async function purgeExpiredS3Objects(maxAgeHours: number = env.RETENTION_HOURS): Promise<number> {
  const cutoffTime = Date.now() - maxAgeHours * 60 * 60 * 1000;
  let deletedCount = 0;
  let continuationToken: string | undefined = undefined;

  try {
    do {
      const listCommand: ListObjectsV2Command = new ListObjectsV2Command({
        Bucket: env.S3_BUCKET,
        ContinuationToken: continuationToken,
      });

      const response = await s3Client.send(listCommand);
      const objectsToDelete: _Object[] = (response.Contents || []).filter(
        (item) => item.LastModified && item.LastModified.getTime() < cutoffTime
      );

      if (objectsToDelete.length > 0) {
        const deleteCommand = new DeleteObjectsCommand({
          Bucket: env.S3_BUCKET,
          Delete: {
            Objects: objectsToDelete.map((o) => ({ Key: o.Key! })),
            Quiet: true,
          },
        });

        await s3Client.send(deleteCommand);
        deletedCount += objectsToDelete.length;
      }

      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    return deletedCount;
  } catch (error) {
    console.error('[S3 Cleanup] Error purging expired objects:', error);
    return deletedCount;
  }
}
