import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { env } from '../config/env.js';
import type {
  MediaMetadataResult,
  TargetFormat,
  TargetQuality,
  JobProgressMetrics,
} from '@media-suite/shared';

export class FfmpegError extends Error {
  public readonly code: string;
  public readonly stderrOutput?: string;
  constructor(message: string, code: string = 'FFMPEG_ERROR', stderrOutput?: string) {
    super(message);
    this.name = 'FfmpegError';
    this.code = code;
    this.stderrOutput = stderrOutput;
  }
}

export interface TranscodeDecision {
  isVideoCopy: boolean;
  isAudioCopy: boolean;
  targetScaleHeight?: number;
  ffmpegArgs: string[];
  outputExtension: string;
  mimeType: string;
}

export interface RunFfmpegOptions {
  inputSource: string;
  outputPath: string;
  metadata: MediaMetadataResult;
  targetFormat: TargetFormat;
  targetQuality?: TargetQuality;
  extractSubtitleTrackIndex?: number;
  onProgress?: (progress: number, metrics: JobProgressMetrics) => void;
  signal?: AbortSignal;
}

const QUALITY_HEIGHT_MAP: Record<TargetQuality, number | undefined> = {
  original: undefined,
  '4k': 2160,
  '1440p': 1440,
  '1080p': 1080,
  '720p': 720,
  '480p': 480,
  '360p': 360,
  '240p': 240,
};

const FORMAT_MIME_MAP: Record<TargetFormat, { ext: string; mime: string }> = {
  mp4: { ext: '.mp4', mime: 'video/mp4' },
  webm: { ext: '.webm', mime: 'video/webm' },
  mp3: { ext: '.mp3', mime: 'audio/mpeg' },
  m4a: { ext: '.m4a', mime: 'audio/mp4' },
  wav: { ext: '.wav', mime: 'audio/wav' },
  srt: { ext: '.srt', mime: 'application/x-subrip' },
  vtt: { ext: '.vtt', mime: 'text/vtt' },
};

/**
 * Checks whether a given source video codec is directly compatible with the target container.
 */
function isVideoCodecCompatible(codec: string, format: TargetFormat): boolean {
  const norm = codec.toLowerCase();
  if (format === 'mp4') {
    return ['h264', 'avc1', 'hevc', 'h265', 'av1', 'vp9'].includes(norm);
  }
  if (format === 'webm') {
    return ['vp8', 'vp9', 'av1'].includes(norm);
  }
  return false;
}

/**
 * Checks whether a given source audio codec is directly compatible with the target container.
 */
function isAudioCodecCompatible(codec: string, format: TargetFormat): boolean {
  const norm = codec.toLowerCase();
  if (format === 'mp4') {
    return ['aac', 'mp3', 'ac3', 'eac3'].includes(norm);
  }
  if (format === 'webm') {
    return ['opus', 'vorbis'].includes(norm);
  }
  if (format === 'mp3') {
    return norm === 'mp3';
  }
  if (format === 'm4a') {
    return ['aac', 'alac'].includes(norm);
  }
  if (format === 'wav') {
    return norm.startsWith('pcm_');
  }
  return false;
}

/**
 * Builds optimized FFmpeg arguments and decides whether stream copying (-c copy) can be used.
 */
export function planTranscode(
  metadata: MediaMetadataResult,
  targetFormat: TargetFormat,
  targetQuality: TargetQuality = 'original',
  subtitleTrackIndex?: number
): TranscodeDecision {
  const formatInfo = FORMAT_MIME_MAP[targetFormat];
  const primaryVideo = metadata.videoStreams[0];
  const primaryAudio = metadata.audioStreams[0];

  const targetHeight = QUALITY_HEIGHT_MAP[targetQuality];
  const requiresDownscale =
    targetHeight !== undefined && primaryVideo && primaryVideo.height > targetHeight;

  let isVideoCopy = false;
  let isAudioCopy = false;

  const args: string[] = ['-y', '-hide_banner', '-nostats'];

  // Handle Subtitle Extraction
  if (targetFormat === 'srt' || targetFormat === 'vtt') {
    const trackIdx = subtitleTrackIndex ?? (metadata.subtitleTracks[0]?.index ?? 0);
    args.push('-map', `0:${trackIdx}`);
    if (targetFormat === 'srt') {
      args.push('-c:s', 'srt');
    } else {
      args.push('-c:s', 'webvtt');
    }
    return {
      isVideoCopy: false,
      isAudioCopy: false,
      ffmpegArgs: args,
      outputExtension: formatInfo.ext,
      mimeType: formatInfo.mime,
    };
  }

  // Handle Audio-Only Targets
  if (['mp3', 'm4a', 'wav'].includes(targetFormat)) {
    args.push('-vn'); // Discard video streams

    if (primaryAudio && isAudioCodecCompatible(primaryAudio.codec, targetFormat)) {
      isAudioCopy = true;
      args.push('-c:a', 'copy');
    } else {
      if (targetFormat === 'mp3') {
        args.push('-c:a', 'libmp3lame', '-b:a', '320k', '-q:a', '0');
      } else if (targetFormat === 'm4a') {
        args.push('-c:a', 'aac', '-b:a', '256k');
      } else if (targetFormat === 'wav') {
        args.push('-c:a', 'pcm_s16le', '-ar', '44100');
      }
    }

    return {
      isVideoCopy: false,
      isAudioCopy,
      ffmpegArgs: args,
      outputExtension: formatInfo.ext,
      mimeType: formatInfo.mime,
    };
  }

  // Handle Video Targets (MP4 / WebM)
  if (primaryVideo) {
    if (!requiresDownscale && isVideoCodecCompatible(primaryVideo.codec, targetFormat)) {
      isVideoCopy = true;
      args.push('-c:v', 'copy');
    } else {
      // Re-encoding required
      if (targetFormat === 'mp4') {
        args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22', '-pix_fmt', 'yuv420p');
      } else if (targetFormat === 'webm') {
        args.push('-c:v', 'libvpx-vp9', '-crf', '30', '-b:v', '0', '-row-mt', '1', '-deadline', 'realtime');
      }

      if (requiresDownscale && targetHeight) {
        // -2 ensures width maintains aspect ratio and is divisible by 2
        args.push('-vf', `scale=-2:${targetHeight}`);
      }
    }
  }

  // Audio handling for video targets
  if (primaryAudio) {
    if (isAudioCodecCompatible(primaryAudio.codec, targetFormat)) {
      isAudioCopy = true;
      args.push('-c:a', 'copy');
    } else {
      if (targetFormat === 'mp4') {
        args.push('-c:a', 'aac', '-b:a', '192k');
      } else if (targetFormat === 'webm') {
        args.push('-c:a', 'libopus', '-b:a', '128k');
      }
    }
  }

  // Fast web playback optimization for MP4
  if (targetFormat === 'mp4') {
    args.push('-movflags', '+faststart');
  }

  return {
    isVideoCopy,
    isAudioCopy,
    targetScaleHeight: targetHeight,
    ffmpegArgs: args,
    outputExtension: formatInfo.ext,
    mimeType: formatInfo.mime,
  };
}

/**
 * Parses microseconds or seconds from FFmpeg out_time strings (e.g. "00:01:23.456000" or out_time_us).
 */
function parseOutTimeSeconds(timeStr: string): number {
  const parts = timeStr.trim().split(':');
  if (parts.length === 3) {
    const hours = Number.parseFloat(parts[0]) || 0;
    const mins = Number.parseFloat(parts[1]) || 0;
    const secs = Number.parseFloat(parts[2]) || 0;
    return hours * 3600 + mins * 60 + secs;
  }
  const val = Number.parseFloat(timeStr);
  return Number.isNaN(val) ? 0 : val;
}

/**
 * Spawns and executes FFmpeg with real-time stdout progress parsing.
 */
export async function executeFfmpegTranscode(options: RunFfmpegOptions): Promise<{
  outputPath: string;
  durationSeconds: number;
  isStreamCopy: boolean;
}> {
  const {
    inputSource,
    outputPath,
    metadata,
    targetFormat,
    targetQuality = 'original',
    extractSubtitleTrackIndex,
    onProgress,
    signal,
  } = options;

  const plan = planTranscode(metadata, targetFormat, targetQuality, extractSubtitleTrackIndex);
  const isStreamCopy = plan.isVideoCopy && (plan.isAudioCopy || metadata.audioStreams.length === 0);

  // Build complete argument array
  const fullArgs: string[] = [];

  const isHttp = inputSource.startsWith('http://') || inputSource.startsWith('https://');
  if (isHttp) {
    fullArgs.push(
      '-protocol_whitelist',
      'http,https,tcp,tls',
      '-timeout',
      '20000000', // 20s network timeout
      '-rw_timeout',
      '20000000'
    );
  }

  fullArgs.push('-i', inputSource);
  fullArgs.push(...plan.ffmpegArgs);
  // Send progress machine-readable key-value updates to stdout pipe
  fullArgs.push('-progress', 'pipe:1');
  fullArgs.push(outputPath);

  return new Promise((resolve, reject) => {
    let proc: ChildProcess | null = null;
    let stderrBuffer = '';
    const totalDuration = metadata.duration || 1;

    try {
      proc = spawn(env.FFMPEG_PATH, fullArgs, {
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (spawnErr) {
      return reject(new FfmpegError(`Failed to spawn FFmpeg: ${(spawnErr as Error).message}`, 'SPAWN_FAILED'));
    }

    if (signal) {
      signal.addEventListener('abort', () => {
        if (proc && !proc.killed) {
          proc.kill('SIGTERM');
          setTimeout(() => {
            if (proc && !proc.killed) proc.kill('SIGKILL');
          }, 3000);
        }
        reject(new FfmpegError('Transcoding cancelled by abort signal', 'CANCELLED'));
      });
    }

    let progressAccumulator = '';
    const currentMetrics: JobProgressMetrics = {};

    proc.stdout?.on('data', (chunk: Buffer) => {
      progressAccumulator += chunk.toString('utf8');
      const lines = progressAccumulator.split('\n');
      progressAccumulator = lines.pop() || ''; // Keep trailing incomplete line

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;
        const eqIdx = line.indexOf('=');
        if (eqIdx === -1) continue;

        const key = line.slice(0, eqIdx).trim();
        const value = line.slice(eqIdx + 1).trim();

        if (key === 'fps') {
          currentMetrics.fps = Number.parseFloat(value) || 0;
        } else if (key === 'speed') {
          currentMetrics.speed = value;
        } else if (key === 'bitrate') {
          currentMetrics.bitrate = value;
        } else if (key === 'out_time') {
          currentMetrics.currentTime = value.slice(0, 8); // e.g. "00:01:23"
          const processedSeconds = parseOutTimeSeconds(value);
          const percent = Math.min(99, Math.max(0, Math.round((processedSeconds / totalDuration) * 100)));

          // Calculate ETA
          let etaSeconds: number | undefined;
          if (currentMetrics.speed && currentMetrics.speed.endsWith('x')) {
            const speedMultiplier = Number.parseFloat(currentMetrics.speed.replace('x', ''));
            if (speedMultiplier > 0) {
              const remainingMediaSeconds = Math.max(0, totalDuration - processedSeconds);
              etaSeconds = Math.round(remainingMediaSeconds / speedMultiplier);
              currentMetrics.etaSeconds = etaSeconds;
            }
          }

          if (onProgress) {
            onProgress(percent, { ...currentMetrics });
          }
        } else if (key === 'progress' && value === 'end') {
          if (onProgress) {
            onProgress(100, { ...currentMetrics, etaSeconds: 0 });
          }
        }
      }
    });

    proc.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf8');
      stderrBuffer += text;
      // Retain only last 4000 characters of stderr for diagnostics
      if (stderrBuffer.length > 8000) {
        stderrBuffer = stderrBuffer.slice(-4000);
      }
    });

    proc.on('error', (err) => {
      reject(new FfmpegError(`FFmpeg process runtime error: ${err.message}`, 'PROCESS_ERROR'));
    });

    proc.on('close', (code) => {
      if (code === 0) {
        // Verify output file actually exists and has non-zero size
        try {
          const stats = fs.statSync(outputPath);
          if (stats.size === 0) {
            return reject(
              new FfmpegError('FFmpeg completed but output file is empty', 'ZERO_BYTE_OUTPUT', stderrBuffer)
            );
          }
          resolve({
            outputPath,
            durationSeconds: totalDuration,
            isStreamCopy,
          });
        } catch (statErr) {
          reject(
            new FfmpegError(
              `Cannot access transcode output file: ${(statErr as Error).message}`,
              'OUTPUT_MISSING',
              stderrBuffer
            )
          );
        }
      } else {
        let errorCode = 'TRANSCODE_FAILED';
        if (stderrBuffer.includes('Invalid data found when processing input')) {
          errorCode = 'CORRUPTED_STREAM';
        } else if (stderrBuffer.includes('Out of memory') || code === 137) {
          errorCode = 'OUT_OF_MEMORY';
        } else if (stderrBuffer.includes('Connection timed out') || stderrBuffer.includes('Server returned 404')) {
          errorCode = 'NETWORK_ERROR';
        }

        reject(
          new FfmpegError(
            `FFmpeg exited with non-zero code ${code}: ${stderrBuffer.slice(-300).trim()}`,
            errorCode,
            stderrBuffer
          )
        );
      }
    });
  });
}
