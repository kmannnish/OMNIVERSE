'use client';

import React, { useState, useMemo } from 'react';
import {
  Zap,
  Sliders,
  FileVideo,
  FileAudio,
  Subtitles,
  ArrowRight,
  Sparkles,
  Info,
} from 'lucide-react';
import type {
  MediaMetadataResult,
  TargetFormat,
  TargetQuality,
  CreateJobResponse,
} from '@media-suite/shared';

interface JobConfiguratorProps {
  metadata: MediaMetadataResult;
  sourceUrl: string;
  onJobCreated: (jobId: string) => void;
  isSubmitting: boolean;
  setIsSubmitting: (val: boolean) => void;
}

const FORMAT_CATEGORIES = [
  {
    category: 'Video Containers',
    icon: FileVideo,
    formats: [
      { id: 'mp4' as TargetFormat, label: 'MP4 (Universal H.264/AAC)', desc: 'Direct browser & mobile playback' },
      { id: 'webm' as TargetFormat, label: 'WebM (VP9/Opus)', desc: 'High-compression open web format' },
    ],
  },
  {
    category: 'Audio Extraction',
    icon: FileAudio,
    formats: [
      { id: 'mp3' as TargetFormat, label: 'MP3 (320 kbps)', desc: 'High-bitrate universal audio' },
      { id: 'm4a' as TargetFormat, label: 'M4A (AAC 256k)', desc: 'High-fidelity Apple audio' },
      { id: 'wav' as TargetFormat, label: 'WAV (Lossless PCM)', desc: 'Uncompressed studio master audio' },
    ],
  },
  {
    category: 'Captions & Subtitles',
    icon: Subtitles,
    formats: [
      { id: 'srt' as TargetFormat, label: 'SubRip (SRT)', desc: 'Universal subtitle track format' },
      { id: 'vtt' as TargetFormat, label: 'WebVTT (VTT)', desc: 'HTML5 native web caption format' },
    ],
  },
];

const QUALITIES: { id: TargetQuality; label: string; desc: string }[] = [
  { id: 'original', label: 'Original Source', desc: 'Preserves native resolution' },
  { id: '4k', label: '4K Ultra HD', desc: '2160p (3840×2160)' },
  { id: '1440p', label: '1440p Quad HD', desc: '1440p (2560×1440)' },
  { id: '1080p', label: '1080p Full HD', desc: '1080p (1920×1080)' },
  { id: '720p', label: '720p HD', desc: '720p (1280×720)' },
  { id: '480p', label: '480p SD', desc: '480p (854×480)' },
  { id: '360p', label: '360p Medium', desc: '360p (640×360)' },
  { id: '240p', label: '240p Data Saver', desc: '240p (426×240)' },
];

export function JobConfigurator({
  metadata,
  sourceUrl,
  onJobCreated,
  isSubmitting,
  setIsSubmitting,
}: JobConfiguratorProps) {
  const [selectedFormat, setSelectedFormat] = useState<TargetFormat>('mp4');
  const [selectedQuality, setSelectedQuality] = useState<TargetQuality>('original');
  const [selectedSubtitleIndex, setSelectedSubtitleIndex] = useState<number>(0);
  const [customFilename, setCustomFilename] = useState('');
  const [error, setError] = useState<string | null>(null);

  const isAudioOnly = ['mp3', 'm4a', 'wav'].includes(selectedFormat);
  const isSubtitleOnly = ['srt', 'vtt'].includes(selectedFormat);

  // Stream copy prediction
  const streamCopyAnalysis = useMemo(() => {
    const primaryVideo = metadata.videoStreams[0];
    const primaryAudio = metadata.audioStreams[0];

    if (isSubtitleOnly) {
      return {
        canStreamCopy: true,
        type: 'subtitle-extract',
        message: 'Direct track demuxing without re-encoding text contents.',
      };
    }

    if (isAudioOnly) {
      const isAac = primaryAudio?.codec.toLowerCase() === 'aac';
      const isMp3 = primaryAudio?.codec.toLowerCase() === 'mp3';
      if ((selectedFormat === 'm4a' && isAac) || (selectedFormat === 'mp3' && isMp3)) {
        return {
          canStreamCopy: true,
          type: 'audio-copy',
          message: 'Direct audio stream copy active (-c:a copy). Ultra-fast demuxing!',
        };
      }
      return {
        canStreamCopy: false,
        type: 'audio-transcode',
        message: 'Resampling audio stream to match chosen codec and bitrate.',
      };
    }

    // Video check
    const videoCodec = primaryVideo?.codec.toLowerCase() || '';
    const isVideoCompatible =
      (selectedFormat === 'mp4' && ['h264', 'hevc', 'h265', 'av1'].includes(videoCodec)) ||
      (selectedFormat === 'webm' && ['vp8', 'vp9', 'av1'].includes(videoCodec));

    if (isVideoCompatible && selectedQuality === 'original') {
      return {
        canStreamCopy: true,
        type: 'full-copy',
        message: '🚀 Stream Copy Enabled (-c copy): Source codec matches container. Zero quality loss at 150x+ speed!',
      };
    }

    return {
      canStreamCopy: false,
      type: 'transcode',
      message: 'Full media transcode required to adapt container, codec, or resolution.',
    };
  }, [metadata, selectedFormat, selectedQuality, isAudioOnly, isSubtitleOnly]);

  const handleSubmit = async () => {
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceUrl,
          targetFormat: selectedFormat,
          targetQuality: isAudioOnly || isSubtitleOnly ? undefined : selectedQuality,
          extractSubtitleTrackIndex: isSubtitleOnly ? selectedSubtitleIndex : undefined,
          customFilename: customFilename.trim() || undefined,
        }),
      });

      const data: CreateJobResponse = await response.json();

      if (!response.ok || !data.success) {
        throw new Error((data as { error?: { message?: string } }).error?.message || 'Failed to dispatch job');
      }

      onJobCreated(data.jobId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Job dispatch error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
          <Sliders className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-white">Transcode & Extraction Pipeline</h2>
          <p className="text-xs text-slate-400">
            Configure container format, resolution scaling, and smart stream-copy bypass.
          </p>
        </div>
      </div>

      {/* Target Format Selector */}
      <div className="space-y-4">
        {FORMAT_CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          return (
            <div key={cat.category} className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                <Icon className="w-3.5 h-3.5 text-indigo-400" />
                {cat.category}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {cat.formats.map((f) => {
                  const isSelected = selectedFormat === f.id;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setSelectedFormat(f.id)}
                      className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-600/15 border-indigo-500 ring-1 ring-indigo-500 text-white'
                          : 'bg-slate-950/50 border-slate-800/80 hover:border-slate-700 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm">{f.label}</span>
                        {isSelected && <Sparkles className="w-4 h-4 text-indigo-400" />}
                      </div>
                      <p className="text-xs text-slate-400 mt-1">{f.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Quality Selection (Only for Video Containers) */}
      {!isAudioOnly && !isSubtitleOnly && (
        <div className="space-y-2 pt-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">
            Target Resolution Scaling
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {QUALITIES.map((q) => {
              const isSelected = selectedQuality === q.id;
              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => setSelectedQuality(q.id)}
                  className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600/20 border-indigo-500 text-white font-medium'
                      : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="text-xs font-semibold">{q.label}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{q.desc}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Subtitle Track Selector (If subtitle format selected) */}
      {isSubtitleOnly && (
        <div className="space-y-2 pt-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">
            Select Embedded Subtitle Track
          </label>
          {metadata.subtitleTracks.length > 0 ? (
            <select
              value={selectedSubtitleIndex}
              onChange={(e) => setSelectedSubtitleIndex(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 outline-none focus:border-indigo-500"
            >
              {metadata.subtitleTracks.map((track) => (
                <option key={track.index} value={track.index}>
                  Track #{track.index}: {track.title} ({track.language}) [{track.codec}]
                </option>
              ))}
            </select>
          ) : (
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 text-xs flex items-center gap-2">
              <Info className="w-4 h-4 flex-shrink-0" />
              No embedded subtitle streams detected in source file.
            </div>
          )}
        </div>
      )}

      {/* Custom Output Filename */}
      <div className="space-y-1 pt-1">
        <label className="text-xs font-medium text-slate-400">Custom Export Filename (Optional)</label>
        <input
          type="text"
          value={customFilename}
          onChange={(e) => setCustomFilename(e.target.value)}
          placeholder={`e.g. ${metadata.filename || 'export'}`}
          className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 outline-none"
        />
      </div>

      {/* Stream Copy Intelligence Callout */}
      <div
        className={`p-4 rounded-xl border flex items-start gap-3 transition-all ${
          streamCopyAnalysis.canStreamCopy
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
            : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300'
        }`}
      >
        <Zap className="w-5 h-5 flex-shrink-0 mt-0.5 text-current animate-pulse-subtle" />
        <div className="text-xs">
          <div className="font-semibold uppercase tracking-wider mb-0.5">
            {streamCopyAnalysis.canStreamCopy ? 'Stream Copy Optimization Active' : 'Adaptive Re-encoding Mode'}
          </div>
          <p className="text-slate-300 leading-relaxed">{streamCopyAnalysis.message}</p>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs">
          {error}
        </div>
      )}

      {/* Dispatch Action Button */}
      <button
        onClick={handleSubmit}
        disabled={isSubmitting || (isSubtitleOnly && metadata.subtitleTracks.length === 0)}
        className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-600 font-semibold text-sm text-white rounded-xl shadow-lg shadow-indigo-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
      >
        {isSubmitting ? (
          <>
            <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            <span>Enqueueing Job to BullMQ...</span>
          </>
        ) : (
          <>
            <span>Launch High-Speed Processing Pipeline</span>
            <ArrowRight className="w-4 h-4" />
          </>
        )}
      </button>
    </div>
  );
}
