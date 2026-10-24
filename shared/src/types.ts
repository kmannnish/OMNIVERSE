export type TargetFormat = 'mp4' | 'webm' | 'mp3' | 'm4a' | 'wav' | 'srt' | 'vtt' | 'jpg' | 'png' | 'webp';

export type TargetQuality = 'original' | '4k' | '1440p' | '1080p' | '720p' | '480p' | '360p' | '240p' | 'maxres' | 'high' | 'standard' | 'medium' | 'small';

export interface ThumbnailOption {
  id: string;
  label: string;
  sub: string;
  url: string;
  width?: number;
  height?: number;
}

export interface VideoStreamInfo {
  index: number;
  codec: string;
  width: number;
  height: number;
  aspectRatio: string;
  fps: number;
  bitrate?: number;
  profile?: string;
  pixelFormat?: string;
  colorSpace?: string;
}

export interface AudioStreamInfo {
  index: number;
  codec: string;
  channels: number;
  channelLayout: string;
  sampleRate: number;
  bitrate?: number;
  language?: string;
}

export interface SubtitleTrackInfo {
  index: number;
  codec: string;
  language: string;
  title: string;
  isDefault: boolean;
  isForced: boolean;
}

export interface ChapterInfo {
  id: number;
  startTime: number;
  endTime: number;
  title: string;
}

export interface MediaMetadataResult {
  filename: string;
  duration: number; // in seconds
  durationFormatted: string; // HH:MM:SS or MM:SS
  formatName: string;
  size?: number; // bytes
  bitrate?: number; // bps
  videoStreams: VideoStreamInfo[];
  audioStreams: AudioStreamInfo[];
  subtitleTracks: SubtitleTrackInfo[];
  chapters: ChapterInfo[];
  thumbnails?: ThumbnailOption[];
  thumbnailUrl?: string;
}

export interface InspectMediaRequest {
  url: string;
}

export interface InspectMediaResponse {
  success: boolean;
  data?: MediaMetadataResult;
  error?: {
    code: string;
    message: string;
  };
}

export interface CreateJobRequest {
  sourceUrl: string;
  targetFormat: TargetFormat;
  targetQuality?: TargetQuality;
  extractSubtitleTrackIndex?: number;
  customFilename?: string;
  thumbnailUrl?: string;
}

export interface CreateJobResponse {
  success: boolean;
  jobId: string;
  status: JobState;
  createdAt: string;
}

export type JobState = 'queued' | 'processing' | 'uploading' | 'completed' | 'failed';

export interface JobProgressMetrics {
  fps?: number;
  speed?: string;
  currentTime?: string;
  etaSeconds?: number;
  bitrate?: string;
}

export interface JobResultDetails {
  downloadUrl: string;
  filename: string;
  fileSize: number;
  mimeType: string;
  durationSeconds: number;
  isStreamCopy: boolean;
  expiresAt: string;
}

export interface JobErrorDetails {
  code: string;
  message: string;
  details?: string;
}

export interface JobProgressEvent {
  jobId: string;
  state: JobState;
  progress: number; // 0 to 100
  stage: string;
  metrics?: JobProgressMetrics;
  result?: JobResultDetails;
  error?: JobErrorDetails;
  timestamp: string;
}

export interface JobStatusResponse {
  jobId: string;
  state: JobState;
  progress: number;
  createdAt: string;
  updatedAt?: string;
  result?: JobResultDetails;
  error?: JobErrorDetails;
}
