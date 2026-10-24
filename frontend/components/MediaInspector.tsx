'use client';

import React, { useState } from 'react';
import {
  Film,
  Music,
  Subtitles,
  Search,
  ShieldCheck,
  AlertTriangle,
  Clock,
  HardDrive,
  Activity,
  Layers,
} from 'lucide-react';
import type { MediaMetadataResult, InspectMediaResponse } from '@media-suite/shared';

interface MediaInspectorProps {
  onInspected: (metadata: MediaMetadataResult, url: string) => void;
  isLoading: boolean;
  setIsLoading: (val: boolean) => void;
}

const SAMPLE_MEDIA = [
  {
    name: 'MDN Flower (H.264 / AAC 540p)',
    url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
  },
  {
    name: 'Big Buck Bunny (VP9 WebM)',
    url: 'https://upload.wikimedia.org/wikipedia/commons/transcoded/c/c0/Big_Buck_Bunny_4K.webm/Big_Buck_Bunny_4K.webm.480p.vp9.webm',
  },
];

export function MediaInspector({ onInspected, isLoading, setIsLoading }: MediaInspectorProps) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<MediaMetadataResult | null>(null);

  const handleInspect = async (targetUrl: string = url) => {
    if (!targetUrl.trim()) {
      setError('Please enter a valid HTTP/HTTPS media URL');
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch('/api/inspect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl.trim() }),
      });

      let data: InspectMediaResponse;
      const text = await response.text();
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`Server returned HTTP ${response.status}: ${text.slice(0, 200) || 'Invalid server response'}`);
      }

      if (!response.ok || !data.success || !data.data) {
        throw new Error(data.error?.message || `Probe failed with status ${response.status}`);
      }

      setMetadata(data.data);
      onInspected(data.data, targetUrl.trim());
    } catch (err) {
      setMetadata(null);
      setError(err instanceof Error ? err.message : 'Failed to inspect media URL');
    } finally {
      setIsLoading(false);
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Dynamic Stream';
    const mb = bytes / (1024 * 1024);
    if (mb > 1024) return `${(mb / 1024).toFixed(2)} GB`;
    return `${mb.toFixed(1)} MB`;
  };

  const formatBitrate = (bps?: number) => {
    if (!bps) return 'Variable';
    return `${Math.round(bps / 1000)} kbps`;
  };

  return (
    <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-2xl p-6 shadow-2xl transition-all">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
            <Search className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">Media Format Inspector</h2>
            <p className="text-xs text-slate-400">
              Asynchronously probe container metadata, codec trees, and stream tracks with zero SSRF risk.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-xs font-medium">
          <ShieldCheck className="w-3.5 h-3.5" />
          SSRF Guard Active
        </div>
      </div>

      {/* Input Group */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleInspect()}
            placeholder="Paste public or pre-signed video URL (e.g. https://domain.com/video.mp4)..."
            className="flex-1 bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-500 outline-none transition-all"
          />
          <button
            onClick={() => handleInspect()}
            disabled={isLoading || !url.trim()}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 font-medium text-sm text-white rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-indigo-600/20 cursor-pointer disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                <span>Probing...</span>
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                <span>Inspect</span>
              </>
            )}
          </button>
        </div>

        {/* Quick sample chips */}
        <div className="flex items-center gap-2 flex-wrap pt-1">
          <span className="text-xs text-slate-500 font-medium">Quick Test Samples:</span>
          {SAMPLE_MEDIA.map((sample) => (
            <button
              key={sample.name}
              onClick={() => {
                setUrl(sample.url);
                handleInspect(sample.url);
              }}
              className="text-xs px-2.5 py-1 bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white rounded-lg border border-slate-700/50 transition-all cursor-pointer"
            >
              {sample.name}
            </button>
          ))}
        </div>
      </div>

      {/* Error Notice */}
      {error && (
        <div className="mt-4 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-3 text-rose-400">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="text-xs">
            <span className="font-semibold block mb-0.5">Inspection Failed</span>
            {error}
          </div>
        </div>
      )}

      {/* Structured Metadata Visualization */}
      {metadata && (
        <div className="mt-6 border-t border-slate-800/80 pt-6 space-y-5 animate-fadeIn">
          {/* Header Overview */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/60">
              <span className="text-xs text-slate-400 flex items-center gap-1.5 mb-1">
                <Clock className="w-3.5 h-3.5 text-indigo-400" /> Duration
              </span>
              <p className="text-base font-semibold text-white">{metadata.durationFormatted}</p>
              <span className="text-[10px] text-slate-500">{metadata.duration.toFixed(1)}s total</span>
            </div>

            <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/60">
              <span className="text-xs text-slate-400 flex items-center gap-1.5 mb-1">
                <HardDrive className="w-3.5 h-3.5 text-emerald-400" /> Size
              </span>
              <p className="text-base font-semibold text-white">{formatFileSize(metadata.size)}</p>
              <span className="text-[10px] text-slate-500">{metadata.formatName}</span>
            </div>

            <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/60">
              <span className="text-xs text-slate-400 flex items-center gap-1.5 mb-1">
                <Activity className="w-3.5 h-3.5 text-amber-400" /> Bitrate
              </span>
              <p className="text-base font-semibold text-white">{formatBitrate(metadata.bitrate)}</p>
              <span className="text-[10px] text-slate-500">Combined stream</span>
            </div>

            <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/60">
              <span className="text-xs text-slate-400 flex items-center gap-1.5 mb-1">
                <Layers className="w-3.5 h-3.5 text-purple-400" /> Tracks
              </span>
              <p className="text-base font-semibold text-white">
                {metadata.videoStreams.length}V / {metadata.audioStreams.length}A /{' '}
                {metadata.subtitleTracks.length}S
              </p>
              <span className="text-[10px] text-slate-500">Streams detected</span>
            </div>
          </div>

          {/* Video Streams */}
          {metadata.videoStreams.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-2">
                <Film className="w-3.5 h-3.5 text-indigo-400" />
                Video Streams ({metadata.videoStreams.length})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {metadata.videoStreams.map((v) => (
                  <div
                    key={v.index}
                    className="p-3 bg-slate-950/40 border border-slate-800/80 rounded-xl flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white">
                          {v.width} × {v.height}
                        </span>
                        <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 bg-indigo-500/20 text-indigo-300 rounded border border-indigo-500/30">
                          {v.codec}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {v.fps} FPS • Aspect: {v.aspectRatio} • {v.pixelFormat || 'yuv420p'}
                      </p>
                    </div>
                    {v.bitrate && (
                      <span className="text-xs text-slate-400 font-mono">
                        {Math.round(v.bitrate / 1000)} kbps
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Audio Streams */}
          {metadata.audioStreams.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-2">
                <Music className="w-3.5 h-3.5 text-emerald-400" />
                Audio Streams ({metadata.audioStreams.length})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {metadata.audioStreams.map((a) => (
                  <div
                    key={a.index}
                    className="p-3 bg-slate-950/40 border border-slate-800/80 rounded-xl flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white capitalize">
                          {a.channelLayout} ({a.channels}ch)
                        </span>
                        <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 rounded border border-emerald-500/30">
                          {a.codec}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {a.sampleRate / 1000} kHz • Lang: {a.language}
                      </p>
                    </div>
                    {a.bitrate && (
                      <span className="text-xs text-slate-400 font-mono">
                        {Math.round(a.bitrate / 1000)} kbps
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Subtitle / Caption Tracks */}
          {metadata.subtitleTracks.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-2">
                <Subtitles className="w-3.5 h-3.5 text-amber-400" />
                Caption & Subtitle Tracks ({metadata.subtitleTracks.length})
              </h3>
              <div className="flex flex-wrap gap-2">
                {metadata.subtitleTracks.map((s) => (
                  <div
                    key={s.index}
                    className="px-3 py-2 bg-slate-950/40 border border-slate-800/80 rounded-xl flex items-center gap-2 text-xs"
                  >
                    <span className="text-slate-200 font-medium">{s.title}</span>
                    <span className="text-[10px] uppercase font-mono px-1 py-0.5 bg-amber-500/20 text-amber-300 rounded">
                      {s.codec}
                    </span>
                    {s.isDefault && (
                      <span className="text-[9px] bg-slate-800 text-slate-400 px-1 py-0.5 rounded">
                        Default
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
