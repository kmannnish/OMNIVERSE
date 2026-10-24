'use client';

import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { X, Clock, Video, Music, Subtitles, ArrowDownRight, Sparkles, ImageIcon } from 'lucide-react';
import type {
  MediaMetadataResult,
  TargetFormat,
  TargetQuality,
} from '@media-suite/shared';

interface QualitySelectorProps {
  metadata: MediaMetadataResult;
  onSelect: (config: {
    format: TargetFormat;
    quality: TargetQuality;
    subtitleTrackIndex?: number;
    thumbnailUrl?: string;
  }) => void;
  onReset: () => void;
  isSubmitting?: boolean;
}

type TabMode = 'video' | 'audio' | 'captions' | 'thumbnail';

const ALL_VIDEO_QUALITIES = [
  { id: 'original' as TargetQuality, label: 'Source', sub: 'Transcendental', height: 9999 },
  { id: '4k' as TargetQuality, label: '4K', sub: 'Imperishable', height: 2160 },
  { id: '1440p' as TargetQuality, label: '2K', sub: 'Pristine QHD', height: 1440 },
  { id: '1080p' as TargetQuality, label: '1080p', sub: 'Radiant Clarity', height: 1080 },
  { id: '720p' as TargetQuality, label: '720p', sub: 'Luminous HD', height: 720 },
  { id: '480p' as TargetQuality, label: '480p', sub: 'Pure Form', height: 480 },
  { id: '360p' as TargetQuality, label: '360p', sub: 'Subtle', height: 360 },
  { id: '240p' as TargetQuality, label: '240p', sub: 'Minimal', height: 240 },
];

export function QualitySelector({
  metadata,
  onSelect,
  onReset,
  isSubmitting = false,
}: QualitySelectorProps) {
  const [activeTab, setActiveTab] = useState<TabMode>('video');

  // Video state
  const [selectedQuality, setSelectedQuality] = useState<TargetQuality>('original');
  const [videoContainer, setVideoContainer] = useState<'mp4' | 'webm'>('mp4');

  // Audio state
  const [audioFormat, setAudioFormat] = useState<'mp3' | 'm4a' | 'wav'>('mp3');

  // Subtitle state
  const [captionFormat, setCaptionFormat] = useState<'srt' | 'vtt'>('srt');
  const [selectedSubtitleIndex, setSelectedSubtitleIndex] = useState<number>(0);

  // Thumbnail state
  const [thumbFormat, setThumbFormat] = useState<'jpg' | 'png' | 'webp'>('jpg');
  const [selectedThumbId, setSelectedThumbId] = useState<string>(
    metadata.thumbnails && metadata.thumbnails.length > 0 ? metadata.thumbnails[0].id : 'maxres'
  );

  // Derive unique video qualities present in metadata
  const availableVideoQualities = useMemo(() => {
    const heights = new Set(metadata.videoStreams.map((v) => v.height));
    const maxHeight = Math.max(...metadata.videoStreams.map((v) => v.height), 0);

    return ALL_VIDEO_QUALITIES.map((q) => {
      const isDirectMatch = heights.has(q.height);
      const isAvailableInSource = q.id === 'original' || (maxHeight > 0 && maxHeight >= q.height);
      return {
        ...q,
        isDirectMatch,
        isAvailableInSource,
      };
    });
  }, [metadata]);

  // Derive available thumbnails
  const availableThumbnails = useMemo(() => {
    if (metadata.thumbnails && metadata.thumbnails.length > 0) {
      return metadata.thumbnails;
    }
    if (metadata.thumbnailUrl) {
      return [
        {
          id: 'maxres',
          label: 'Maximum Quality',
          sub: 'Original • Luminous',
          url: metadata.thumbnailUrl,
        },
      ];
    }
    return [];
  }, [metadata]);

  const activeThumbnail = useMemo(() => {
    return availableThumbnails.find((t) => t.id === selectedThumbId) || availableThumbnails[0];
  }, [availableThumbnails, selectedThumbId]);

  const handleAction = () => {
    if (activeTab === 'video') {
      onSelect({
        format: videoContainer,
        quality: selectedQuality,
      });
    } else if (activeTab === 'audio') {
      onSelect({
        format: audioFormat,
        quality: 'original',
      });
    } else if (activeTab === 'captions') {
      onSelect({
        format: captionFormat,
        quality: 'original',
        subtitleTrackIndex: selectedSubtitleIndex,
      });
    } else if (activeTab === 'thumbnail') {
      onSelect({
        format: thumbFormat,
        quality: (selectedThumbId as TargetQuality) || 'maxres',
        thumbnailUrl: activeThumbnail ? activeThumbnail.url : metadata.thumbnailUrl,
      });
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
      className="max-w-lg w-full mx-auto bg-[#08090E]/85 backdrop-blur-3xl border border-white/[0.08] hover:border-[#F3E5AB]/30 rounded-[2rem] p-7 shadow-[0_0_100px_-20px_rgba(243,229,171,0.18)] relative z-20 space-y-6 transition-colors"
    >
      {/* Header: Title, Duration Badge & Reset Button */}
      <div className="flex items-center justify-between gap-3 pb-2 border-b border-white/[0.06]">
        <div className="flex-1 min-w-0 pr-2">
          <h3
            className="text-base font-medium text-white truncate tracking-tight"
            title={metadata.filename}
          >
            {metadata.filename}
          </h3>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="inline-flex items-center gap-1.5 text-xs font-mono text-[#F3E5AB] bg-[#F3E5AB]/10 px-2.5 py-1 rounded-md border border-[#F3E5AB]/20">
              <Clock className="w-3.5 h-3.5 text-[#F3E5AB]" />
              {metadata.durationFormatted}
            </span>
            {metadata.size && (
              <span className="text-xs text-zinc-400 font-mono">
                {(metadata.size / (1024 * 1024)).toFixed(1)} MB
              </span>
            )}
          </div>
        </div>

        <button
          onClick={onReset}
          className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
          aria-label="Close and reset"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Mode Switcher (Sliding Segmented Control) */}
      <div className="relative p-1 bg-white/[0.03] border border-white/[0.06] rounded-2xl grid grid-cols-4 gap-1">
        {(
          [
            { id: 'video', label: 'Visual', icon: Video },
            { id: 'audio', label: 'Audio', icon: Music },
            { id: 'captions', label: 'Words', icon: Subtitles },
            { id: 'thumbnail', label: 'Radiant', icon: ImageIcon },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="relative py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer flex items-center justify-center gap-1.5 z-10"
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#F3E5AB]' : 'text-zinc-500'}`} />
              <span className={isActive ? 'text-white font-semibold' : 'text-zinc-400'}>{tab.label}</span>
              {isActive && (
                <motion.div
                  layoutId="activeTabIndicator"
                  transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                  className="absolute inset-0 bg-white/[0.08] border border-white/[0.14] rounded-xl -z-10 shadow-sm"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab 1: Video Config */}
      {activeTab === 'video' && (
        <motion.div
          key="tab-video"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.15 }}
          className="space-y-4"
        >
          {/* Container Format */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-400">Container</span>
            <div className="flex items-center gap-1.5">
              {(['mp4', 'webm'] as const).map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => setVideoContainer(fmt)}
                  className={`px-2.5 py-1 rounded-lg uppercase font-mono text-[11px] transition-all cursor-pointer ${
                    videoContainer === fmt
                      ? 'bg-white text-black font-semibold'
                      : 'bg-white/[0.03] text-zinc-400 hover:text-white border border-white/[0.06]'
                  }`}
                >
                  {fmt}
                </button>
              ))}
            </div>
          </div>

          {/* Quality Grid */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-400">Resolution Target</span>
              {metadata.videoStreams[0] && (
                <span className="text-[10px] text-zinc-500 font-mono">
                  Source: {metadata.videoStreams[0].height}p ({metadata.videoStreams[0].fps || 30}fps)
                </span>
              )}
            </div>
            <div className="grid grid-cols-4 gap-2">
              {availableVideoQualities.map((q) => {
                const isSelected = selectedQuality === q.id;
                return (
                  <button
                    key={q.id}
                    onClick={() => setSelectedQuality(q.id)}
                    className={`py-2.5 px-2 rounded-xl border text-center transition-all cursor-pointer relative ${
                      isSelected
                        ? 'bg-white text-black font-semibold border-transparent shadow-[0_0_25px_rgba(255,255,255,0.35)]'
                        : 'bg-white/[0.03] border-white/[0.08] text-zinc-300 hover:text-white hover:bg-white/[0.08] hover:border-white/20'
                    }`}
                  >
                    <div className="text-xs font-semibold tracking-tight">{q.label}</div>
                    <div className={`text-[10px] mt-0.5 font-mono ${isSelected ? 'text-zinc-600' : 'text-zinc-500'}`}>
                      {q.sub}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </motion.div>
      )}

      {/* Tab 2: Audio Config */}
      {activeTab === 'audio' && (
        <motion.div
          key="tab-audio"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.15 }}
          className="space-y-3"
        >
          <span className="text-xs text-zinc-400 block">Select Audio Essence</span>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'mp3' as const, label: 'MP3', sub: '320k Pure Master' },
              { id: 'm4a' as const, label: 'M4A', sub: '256k Pure AAC' },
              { id: 'wav' as const, label: 'WAV', sub: 'Lossless Pristine' },
            ].map((a) => {
              const isSelected = audioFormat === a.id;
              return (
                <button
                  key={a.id}
                  onClick={() => setAudioFormat(a.id)}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-white text-black font-medium border-transparent shadow-[0_0_25px_rgba(255,255,255,0.35)]'
                      : 'bg-white/[0.03] border-white/[0.08] text-zinc-400 hover:text-white hover:bg-white/[0.08] hover:border-white/20'
                  }`}
                >
                  <div className="text-xs font-semibold">{a.label}</div>
                  <div className={`text-[10px] mt-0.5 ${isSelected ? 'text-zinc-600' : 'text-zinc-500'}`}>
                    {a.sub}
                  </div>
                </button>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Tab 3: Captions Config */}
      {activeTab === 'captions' && (
        <motion.div
          key="tab-captions"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.15 }}
          className="space-y-3"
        >
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-400">Subtitle Format</span>
            <div className="flex items-center gap-1.5">
              {(['srt', 'vtt'] as const).map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => setCaptionFormat(fmt)}
                  className={`px-2.5 py-1 rounded-lg uppercase font-mono text-[11px] transition-all cursor-pointer ${
                    captionFormat === fmt
                      ? 'bg-white text-black font-semibold'
                      : 'bg-white/[0.03] text-zinc-400 hover:text-white border border-white/[0.06]'
                  }`}
                >
                  {fmt}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-xs text-zinc-400 block">Available Tracks</span>
            {metadata.subtitleTracks.length > 0 ? (
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {metadata.subtitleTracks.map((track) => {
                  const isSelected = selectedSubtitleIndex === track.index;
                  return (
                    <button
                      key={track.index}
                      onClick={() => setSelectedSubtitleIndex(track.index)}
                      className={`w-full p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? 'bg-white text-black font-medium border-transparent shadow-[0_0_20px_rgba(255,255,255,0.35)]'
                          : 'bg-white/[0.03] border-white/[0.08] text-zinc-400 hover:text-white hover:bg-white/[0.08]'
                      }`}
                    >
                      <span className="text-xs font-medium truncate">{track.title}</span>
                      <span className="text-[10px] uppercase font-mono opacity-60">
                        {track.language}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl text-center text-xs text-zinc-500">
                No embedded subtitle tracks detected in this asset.
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Tab 4: Thumbnail Config (Radiant Vision) */}
      {activeTab === 'thumbnail' && (
        <motion.div
          key="tab-thumbnail"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.15 }}
          className="space-y-4"
        >
          {/* Format selector */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-400">Image Format</span>
            <div className="flex items-center gap-1.5">
              {(['jpg', 'png', 'webp'] as const).map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => setThumbFormat(fmt)}
                  className={`px-2.5 py-1 rounded-lg uppercase font-mono text-[11px] transition-all cursor-pointer ${
                    thumbFormat === fmt
                      ? 'bg-white text-black font-semibold shadow-[0_0_15px_rgba(255,255,255,0.3)]'
                      : 'bg-white/[0.03] text-zinc-400 hover:text-white border border-white/[0.06]'
                  }`}
                >
                  {fmt}
                </button>
              ))}
            </div>
          </div>

          {/* Thumbnail Live Preview */}
          {activeThumbnail?.url && (
            <div className="relative w-full aspect-video rounded-2xl overflow-hidden border border-white/[0.1] bg-black/40 shadow-inner group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={activeThumbnail.url}
                alt={metadata.filename}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
              <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between pointer-events-none">
                <span className="text-[10px] font-mono tracking-wider uppercase text-zinc-300 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded border border-white/10">
                  {activeThumbnail.label}
                </span>
                {activeThumbnail.width ? (
                  <span className="text-[10px] font-mono text-[#F3E5AB] bg-[#F3E5AB]/10 px-2 py-0.5 rounded border border-[#F3E5AB]/30 backdrop-blur-md">
                    {activeThumbnail.width} × {activeThumbnail.height}
                  </span>
                ) : null}
              </div>
            </div>
          )}

          {/* Available Quality Pills */}
          <div className="space-y-2">
            <span className="text-xs text-zinc-400 block">Available Resolutions</span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {availableThumbnails.map((t) => {
                const isSelected = (selectedThumbId || availableThumbnails[0]?.id) === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setSelectedThumbId(t.id)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-white text-black font-medium border-transparent shadow-[0_0_25px_rgba(255,255,255,0.35)]'
                        : 'bg-white/[0.03] border-white/[0.08] text-zinc-400 hover:text-white hover:bg-white/[0.08] hover:border-white/20'
                    }`}
                  >
                    <div className="text-xs font-semibold tracking-tight">{t.label}</div>
                    <div className={`text-[10px] mt-0.5 font-mono truncate ${isSelected ? 'text-zinc-600' : 'text-zinc-500'}`}>
                      {t.sub}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </motion.div>
      )}

      {/* Action Button: Manifest */}
      <motion.button
        whileHover={{ scale: 1.015 }}
        whileTap={{ scale: 0.98 }}
        onClick={handleAction}
        disabled={
          isSubmitting ||
          (activeTab === 'captions' && metadata.subtitleTracks.length === 0) ||
          (activeTab === 'thumbnail' && availableThumbnails.length === 0)
        }
        className="w-full py-4 rounded-2xl shimmer-celestial-btn text-black font-semibold text-sm tracking-widest uppercase transition-all shadow-[0_0_50px_rgba(243,229,171,0.35)] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Sparkles className="w-4 h-4 text-black" />
        <span>
          {activeTab === 'thumbnail'
            ? 'Manifest Radiant Thumbnail'
            : activeTab === 'audio'
            ? 'Manifest Audio Essence'
            : activeTab === 'captions'
            ? 'Manifest Divine Words'
            : 'Manifest Pure Stream'}
        </span>
        <ArrowDownRight className="w-4 h-4 text-black" />
      </motion.button>
    </motion.div>
  );
}
