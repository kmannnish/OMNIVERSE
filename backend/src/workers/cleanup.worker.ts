import fs from 'node:fs/promises';
import path from 'node:path';
import { env } from '../config/env.js';
import { purgeExpiredS3Objects } from '../lib/s3.js';

/**
 * Scans the local scratch directory and deletes orphaned temporary files older than maxAgeMs.
 */
export async function cleanOrphanedScratchFiles(maxAgeMs: number = 60 * 60 * 1000): Promise<number> {
  const dir = env.SCRATCH_DIR;
  let cleanedCount = 0;
  const now = Date.now();

  try {
    const entries = await fs.readdir(dir);
    for (const entry of entries) {
      const fullPath = path.join(dir, entry);
      try {
        const stats = await fs.stat(fullPath);
        if (stats.isFile() && now - stats.mtimeMs > maxAgeMs) {
          await fs.unlink(fullPath);
          cleanedCount++;
          console.log(`[Scratch Cleanup] Removed orphaned file: ${entry}`);
        }
      } catch (err) {
        console.warn(`[Scratch Cleanup] Error inspecting ${entry}:`, (err as Error).message);
      }
    }
  } catch (err) {
    console.warn('[Scratch Cleanup] Error reading scratch directory:', (err as Error).message);
  }

  return cleanedCount;
}

/**
 * Runs a full maintenance cycle: local scratch sweep + S3 24h expiration purge.
 */
export async function runFullMaintenanceSweep(): Promise<{
  localFilesPurged: number;
  s3ObjectsPurged: number;
}> {
  console.log('[Maintenance Worker] Starting periodic storage maintenance sweep...');

  const localFilesPurged = await cleanOrphanedScratchFiles(60 * 60 * 1000); // files > 1 hour
  const s3ObjectsPurged = await purgeExpiredS3Objects(env.RETENTION_HOURS); // objects > 24 hours

  console.log(
    `[Maintenance Worker] Sweep complete: ${localFilesPurged} local scratch files removed, ${s3ObjectsPurged} expired S3 objects purged.`
  );

  return { localFilesPurged, s3ObjectsPurged };
}

/**
 * Starts a recurring background timer for the cleanup maintenance sweep.
 */
export function startPeriodicCleanupWorker(intervalMs: number = 60 * 60 * 1000): NodeJS.Timeout {
  console.log(`[Maintenance Worker] Initialized with interval of ${intervalMs / 1000}s`);

  // Run initial pass after 10 seconds of boot
  setTimeout(() => {
    runFullMaintenanceSweep().catch((err) => console.error('[Maintenance Worker] Initial sweep error:', err));
  }, 10000);

  // Periodic recurring timer
  return setInterval(() => {
    runFullMaintenanceSweep().catch((err) => console.error('[Maintenance Worker] Sweep error:', err));
  }, intervalMs);
}
