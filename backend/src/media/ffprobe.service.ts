import { spawn } from 'node:child_process';
import path from 'node:path';
import { env } from '../config/env.js';
import type {
  MediaMetadataResult,
  VideoStreamInfo,
  AudioStreamInfo,
  SubtitleTrackInfo,
  ChapterInfo,
} from '@media-suite/shared';

interface RawFfprobeStream {
  index: number;
  codec_name?: string;
  codec_type?: 'video' | 'audio' | 'subtitle' | 'data' | 'attachment';
  width?: number;
  height?: number;
  display_aspect_ratio?: string;
  r_frame_rate?: string;
  avg_frame_rate?: string;
  bit_rate?: string;
  profile?: string;
  pix_fmt?: string;
  color_space?: string;
  channels?: number;
  channel_layout?: string;
  sample_rate?: string;
  disposition?: {
    default?: number;
    forced?: number;
  };
  tags?: Record<string, string>;
}

interface RawFfprobeChapter {
  id: number;
  start_time: string;
  end_time: string;
  tags?: {
    title?: string;
  };
}

interface RawFfprobeOutput {
  format?: {
    filename?: string;
    format_name?: string;
    duration?: string;
    size?: string;
    bit_rate?: string;
    tags?: Record<string, string>;
  };
  streams?: RawFfprobeStream[];
  chapters?: RawFfprobeChapter[];
  error?: {
    code: number;
    string: string;
  };
}

export class FfprobeError extends Error {
  public readonly code: string;
  constructor(message: string, code: string = 'FFPROBE_ERROR') {
    super(message);
    this.name = 'FfprobeError';
    this.code = code;
  }
}

/**
 * Calculates a numeric frame rate from an FFmpeg fractional string like "30/1" or "30000/1001".
 */
function parseFrameRate(rateStr?: string): number {
  if (!rateStr) return 0;
  const parts = rateStr.split('/');
  if (parts.length === 2) {
    const num = Number.parseFloat(parts[0]);
    const den = Number.parseFloat(parts[1]);
    if (den > 0) return Math.round((num / den) * 100) / 100;
  }
  const val = Number.parseFloat(rateStr);
  return Number.isNaN(val) ? 0 : Math.round(val * 100) / 100;
}

/**
 * Formats seconds into HH:MM:SS or MM:SS
 */
function formatDuration(totalSeconds: number): string {
  if (Number.isNaN(totalSeconds) || totalSeconds <= 0) return '00:00';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  const pad = (n: number) => n.toString().padStart(2, '0');
  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Executes ffprobe asynchronously with strict sanitization and returns structured media details.
 */
export async function probeMedia(inputSource: string): Promise<MediaMetadataResult> {
  const isHttp = inputSource.startsWith('http://') || inputSource.startsWith('https://');

  const args: string[] = [
    '-v',
    'quiet',
    '-print_format',
    'json',
    '-show_format',
    '-show_streams',
    '-show_chapters',
    '-show_error',
  ];

  if (isHttp) {
    args.push(
      '-protocol_whitelist',
      'http,https,tcp,tls',
      '-timeout',
      '15000000', // 15 seconds in microseconds
      '-rw_timeout',
      '15000000'
    );
  }

  args.push('-i', inputSource);

  return new Promise((resolve, reject) => {
    const proc = spawn(env.FFPROBE_PATH, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdoutData = '';
    let stderrData = '';

    proc.stdout.on('data', (chunk: Buffer) => {
      stdoutData += chunk.toString('utf8');
    });

    proc.stderr.on('data', (chunk: Buffer) => {
      stderrData += chunk.toString('utf8');
    });

    // Set fallback timeout if ffprobe process hangs
    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new FfprobeError('FFprobe process timed out after 20 seconds', 'PROBE_TIMEOUT'));
    }, 20000);

    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(new FfprobeError(`Failed to spawn ffprobe binary: ${err.message}`, 'SPAWN_FAILED'));
    });

    proc.on('close', (exitCode) => {
      clearTimeout(timer);

      if (exitCode !== 0) {
        const errorDetail = stderrData.trim() || `Exit code ${exitCode}`;
        return reject(
          new FfprobeError(
            `FFprobe failed to inspect media: ${errorDetail}`,
            'PROBE_EXECUTION_FAILED'
          )
        );
      }

      try {
        const rawJson: RawFfprobeOutput = JSON.parse(stdoutData);

        if (rawJson.error) {
          return reject(
            new FfprobeError(
              `FFprobe reported error: ${rawJson.error.string} (code: ${rawJson.error.code})`,
              'CORRUPTED_STREAM'
            )
          );
        }

        const format = rawJson.format || {};
        const streams = rawJson.streams || [];
        const rawChapters = rawJson.chapters || [];

        const duration = Number.parseFloat(format.duration || '0');
        const size = format.size ? Number.parseInt(format.size, 10) : undefined;
        const bitrate = format.bit_rate ? Number.parseInt(format.bit_rate, 10) : undefined;

        // Derive friendly title/filename
        let filename = 'unknown_media';
        if (format.tags?.title) {
          filename = format.tags.title;
        } else if (isHttp) {
          try {
            const urlObj = new URL(inputSource);
            filename = path.basename(urlObj.pathname) || 'stream_media';
          } catch {
            filename = 'stream_media';
          }
        } else {
          filename = path.basename(inputSource);
        }

        const videoStreams: VideoStreamInfo[] = [];
        const audioStreams: AudioStreamInfo[] = [];
        const subtitleTracks: SubtitleTrackInfo[] = [];

        for (const stream of streams) {
          if (stream.codec_type === 'video') {
            const fps = parseFrameRate(stream.avg_frame_rate) || parseFrameRate(stream.r_frame_rate);
            videoStreams.push({
              index: stream.index,
              codec: stream.codec_name || 'unknown',
              width: stream.width || 0,
              height: stream.height || 0,
              aspectRatio: stream.display_aspect_ratio || `${stream.width || 0}:${stream.height || 0}`,
              fps,
              bitrate: stream.bit_rate ? Number.parseInt(stream.bit_rate, 10) : undefined,
              profile: stream.profile,
              pixelFormat: stream.pix_fmt,
              colorSpace: stream.color_space,
            });
          } else if (stream.codec_type === 'audio') {
            audioStreams.push({
              index: stream.index,
              codec: stream.codec_name || 'unknown',
              channels: stream.channels || 0,
              channelLayout: stream.channel_layout || 'stereo',
              sampleRate: stream.sample_rate ? Number.parseInt(stream.sample_rate, 10) : 0,
              bitrate: stream.bit_rate ? Number.parseInt(stream.bit_rate, 10) : undefined,
              language: stream.tags?.language || 'und',
            });
          } else if (stream.codec_type === 'subtitle') {
            subtitleTracks.push({
              index: stream.index,
              codec: stream.codec_name || 'unknown',
              language: stream.tags?.language || 'und',
              title: stream.tags?.title || `Track ${stream.index} (${stream.tags?.language || 'und'})`,
              isDefault: Boolean(stream.disposition?.default),
              isForced: Boolean(stream.disposition?.forced),
            });
          }
        }

        const chapters: ChapterInfo[] = rawChapters.map((c) => ({
          id: c.id,
          startTime: Number.parseFloat(c.start_time || '0'),
          endTime: Number.parseFloat(c.end_time || '0'),
          title: c.tags?.title || `Chapter ${c.id + 1}`,
        }));

        const result: MediaMetadataResult = {
          filename,
          duration,
          durationFormatted: formatDuration(duration),
          formatName: format.format_name || 'unknown',
          size,
          bitrate,
          videoStreams,
          audioStreams,
          subtitleTracks,
          chapters,
        };

        resolve(result);
      } catch (parseErr) {
        reject(
          new FfprobeError(
            `Failed to parse FFprobe JSON output: ${(parseErr as Error).message}`,
            'INVALID_FFPROBE_JSON'
          )
        );
      }
    });
  });
}
