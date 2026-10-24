import { spawn } from 'node:child_process';
import path from 'node:path';
import type {
  MediaMetadataResult,
  VideoStreamInfo,
  AudioStreamInfo,
  SubtitleTrackInfo,
  TargetFormat,
  TargetQuality,
  JobProgressMetrics,
} from '@media-suite/shared';

export class YtDlpError extends Error {
  public readonly code: string;
  constructor(message: string, code: string = 'YTDLP_ERROR') {
    super(message);
    this.name = 'YtDlpError';
    this.code = code;
  }
}

/**
 * Checks if a URL belongs to a streaming portal supported by yt-dlp.
 */
export function isStreamingPortalUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.toLowerCase();
    return (
      host.includes('youtube.com') ||
      host.includes('youtu.be') ||
      host.includes('vimeo.com') ||
      host.includes('dailymotion.com') ||
      host.includes('soundcloud.com') ||
      host.includes('twitch.tv')
    );
  } catch {
    return false;
  }
}

function formatDuration(totalSeconds: number): string {
  if (Number.isNaN(totalSeconds) || totalSeconds <= 0) return '00:00';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const pad = (n: number) => n.toString().padStart(2, '0');
  if (hours > 0) return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return `${pad(minutes)}:${pad(seconds)}`;
}

interface YtDlpFormat {
  format_id?: string;
  vcodec?: string;
  acodec?: string;
  width?: number;
  height?: number;
  fps?: number;
  tbr?: number;
  filesize?: number;
  filesize_approx?: number;
  ext?: string;
  audio_channels?: number;
  asr?: number;
}

interface YtDlpJson {
  title?: string;
  duration?: number;
  filesize?: number;
  filesize_approx?: number;
  ext?: string;
  formats?: YtDlpFormat[];
  subtitles?: Record<string, { ext: string; url: string; name?: string }[]>;
  automatic_captions?: Record<string, { ext: string; url: string; name?: string }[]>;
}

/**
 * Probes a streaming portal URL using yt-dlp to extract streams, resolutions, audio tracks, and metadata.
 */
export async function probeStreamingPortal(url: string): Promise<MediaMetadataResult> {
  const args = [
    '-j',
    '--no-warnings',
    '--no-playlist',
    '--no-check-certificates',
    '--extractor-args',
    'youtube:player_client=web_embedded,android,web',
    '--user-agent',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    url,
  ];

  return new Promise((resolve, reject) => {
    const proc = spawn('yt-dlp', args, {
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

    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new YtDlpError('yt-dlp metadata extraction timed out after 30 seconds', 'TIMEOUT'));
    }, 30000);

    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        const errorText = stderrData.trim() || `Exit code ${code}`;
        return reject(new YtDlpError(`Failed to extract portal stream info: ${errorText}`, 'PORTAL_EXTRACTION_FAILED'));
      }

      try {
        const info: YtDlpJson = JSON.parse(stdoutData.trim());
        const title = info.title || 'streaming_media';
        const duration = info.duration || 0;
        const formats = info.formats || [];

        // Filter and deduplicate unique video resolutions
        const videoStreamsMap = new Map<string, VideoStreamInfo>();
        let videoIdx = 0;

        for (const f of formats) {
          if (f.vcodec && f.vcodec !== 'none' && f.width && f.height) {
            const key = `${f.width}x${f.height}`;
            if (!videoStreamsMap.has(key)) {
              videoStreamsMap.set(key, {
                index: videoIdx++,
                codec: f.vcodec.split('.')[0] || 'h264',
                width: f.width,
                height: f.height,
                aspectRatio: `${f.width}:${f.height}`,
                fps: f.fps || 30,
                bitrate: f.tbr ? Math.round(f.tbr * 1000) : undefined,
                pixelFormat: 'yuv420p',
              });
            }
          }
        }

        // Filter and deduplicate audio streams
        const audioStreams: AudioStreamInfo[] = [];
        let audioFound = false;

        for (const f of formats) {
          if (f.acodec && f.acodec !== 'none' && (!f.vcodec || f.vcodec === 'none')) {
            audioStreams.push({
              index: 1,
              codec: f.acodec.split('.')[0] || 'opus',
              channels: f.audio_channels || 2,
              channelLayout: f.audio_channels === 1 ? 'mono' : 'stereo',
              sampleRate: f.asr || 48000,
              bitrate: f.tbr ? Math.round(f.tbr * 1000) : 128000,
              language: 'und',
            });
            audioFound = true;
            break; // Keep best audio track
          }
        }

        if (!audioFound) {
          audioStreams.push({
            index: 1,
            codec: 'aac',
            channels: 2,
            channelLayout: 'stereo',
            sampleRate: 48000,
            bitrate: 192000,
            language: 'und',
          });
        }

        // Subtitles & Captions
        const subtitleTracks: SubtitleTrackInfo[] = [];
        let subIdx = 0;
        const rawSubs = { ...info.subtitles, ...info.automatic_captions };

        for (const [lang, trackList] of Object.entries(rawSubs)) {
          if (trackList && trackList.length > 0) {
            subtitleTracks.push({
              index: subIdx++,
              codec: trackList[0].ext || 'vtt',
              language: lang,
              title: trackList[0].name || `Captions (${lang})`,
              isDefault: lang === 'en',
              isForced: false,
            });
            if (subIdx >= 10) break; // Limit list to first 10 for UI clarity
          }
        }

        const videoStreams = Array.from(videoStreamsMap.values()).sort((a, b) => b.height - a.height);

        resolve({
          filename: title,
          duration,
          durationFormatted: formatDuration(duration),
          formatName: info.ext || 'mp4',
          size: info.filesize || info.filesize_approx,
          videoStreams,
          audioStreams,
          subtitleTracks,
          chapters: [],
        });
      } catch (parseErr) {
        reject(new YtDlpError(`Failed to parse yt-dlp metadata JSON: ${(parseErr as Error).message}`, 'PARSE_ERROR'));
      }
    });
  });
}

export interface DownloadPortalMediaOptions {
  url: string;
  outputPath: string;
  targetFormat: TargetFormat;
  targetQuality?: TargetQuality;
  onProgress?: (percent: number, metrics: JobProgressMetrics) => void;
  signal?: AbortSignal;
}

const QUALITY_FILTER_MAP: Record<TargetQuality, string | undefined> = {
  original: undefined,
  '4k': '2160',
  '1440p': '1440',
  '1080p': '1080',
  '720p': '720',
  '480p': '480',
  '360p': '360',
  '240p': '240',
};

/**
 * Downloads and formats media from a streaming portal with real-time percentage progress.
 */
export async function downloadPortalMedia(options: DownloadPortalMediaOptions): Promise<{ outputPath: string }> {
  const { url, outputPath, targetFormat, targetQuality = 'original', onProgress, signal } = options;

  const isAudioOnly = ['mp3', 'm4a', 'wav'].includes(targetFormat);
  const isSubtitleOnly = ['srt', 'vtt'].includes(targetFormat);

  const args: string[] = [
    '--no-warnings',
    '--no-playlist',
    '--no-check-certificates',
    '--extractor-args',
    'youtube:player_client=web_embedded,android,web',
    '--user-agent',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    '--newline',
    '--progress-template',
    'PROGRESS:%(progress._percent_str)s|%(progress._speed_str)s|%(progress._eta_str)s',
    '-o',
    outputPath,
  ];

  if (isSubtitleOnly) {
    args.push('--skip-download', '--write-sub', '--sub-format', targetFormat);
  } else if (isAudioOnly) {
    args.push('-x', '--audio-format', targetFormat);
    if (targetFormat === 'mp3') {
      args.push('--audio-quality', '320k');
    }
  } else {
    // Video containers
    const maxQuality = QUALITY_FILTER_MAP[targetQuality];
    const formatFilter = maxQuality
      ? `bestvideo[height<=?${maxQuality}]+bestaudio/best[height<=?${maxQuality}]/best`
      : 'bestvideo+bestaudio/best';

    args.push('-f', formatFilter, '--merge-output-format', targetFormat);
  }

  args.push(url);

  return new Promise((resolve, reject) => {
    const proc = spawn('yt-dlp', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stderrBuffer = '';

    if (signal) {
      signal.addEventListener('abort', () => {
        proc.kill('SIGTERM');
        reject(new YtDlpError('Download cancelled', 'CANCELLED'));
      });
    }

    let progressAccumulator = '';
    proc.stdout.on('data', (chunk: Buffer) => {
      progressAccumulator += chunk.toString('utf8');
      const lines = progressAccumulator.split('\n');
      progressAccumulator = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('PROGRESS:')) {
          const parts = line.replace('PROGRESS:', '').trim().split('|');
          const rawPercent = parts[0]?.replace('%', '').trim();
          const speed = parts[1]?.trim();
          const eta = parts[2]?.trim();

          const numericPercent = Number.parseFloat(rawPercent);
          if (!Number.isNaN(numericPercent) && onProgress) {
            let etaSeconds: number | undefined;
            if (eta && eta.includes(':')) {
              const [m, s] = eta.split(':').map(Number);
              etaSeconds = (m || 0) * 60 + (s || 0);
            }
            onProgress(Math.min(99, Math.round(numericPercent)), {
              speed: speed || undefined,
              etaSeconds,
            });
          }
        }
      }
    });

    proc.stderr.on('data', (chunk: Buffer) => {
      stderrBuffer += chunk.toString('utf8');
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ outputPath });
      } else {
        reject(
          new YtDlpError(
            `yt-dlp exited with error code ${code}: ${stderrBuffer.slice(-300).trim()}`,
            'DOWNLOAD_FAILED'
          )
        );
      }
    });
  });
}
