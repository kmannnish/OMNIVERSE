'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clipboard, ArrowRight, CornerDownLeft, Sparkles } from 'lucide-react';
import { SingularityOrb } from './SingularityOrb';
import { QualitySelector } from './QualitySelector';
import { ProgressOrb } from './ProgressOrb';
import type {
  MediaMetadataResult,
  InspectMediaResponse,
  CreateJobResponse,
  JobProgressEvent,
  TargetFormat,
  TargetQuality,
} from '@media-suite/shared';

type MachineState = 'IDLE' | 'INSPECTING' | 'SELECTION' | 'PROCESSING' | 'COMPLETED' | 'ERROR';

export function BlackHoleCore() {
  const [state, setState] = useState<MachineState>('IDLE');
  const [url, setUrl] = useState('');
  const [metadata, setMetadata] = useState<MediaMetadataResult | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [progressEvent, setProgressEvent] = useState<JobProgressEvent | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // 1. Global Keyboard Listeners: Global Paste (⌘V/Ctrl+V) and Escape to Reset
  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      // If already inspecting or processing, ignore
      if (['INSPECTING', 'PROCESSING'].includes(state)) return;

      const pastedText = e.clipboardData?.getData('text')?.trim();
      if (pastedText && (pastedText.startsWith('http://') || pastedText.startsWith('https://'))) {
        setUrl(pastedText);
        handleInspect(pastedText);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleReset();
      }
    };

    window.addEventListener('paste', handleGlobalPaste);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('paste', handleGlobalPaste);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [state]);

  // 2. Action: One-tap Paste from Clipboard
  const handleClipboardPaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const trimmed = text.trim();
      if (trimmed) {
        setUrl(trimmed);
        handleInspect(trimmed);
      }
    } catch {
      inputRef.current?.focus();
    }
  };

  // 3. Action: Inspect Media URL
  const handleInspect = async (targetUrl: string = url) => {
    const trimmed = targetUrl.trim();
    if (!trimmed) return;

    setErrorMessage(null);
    setState('INSPECTING');

    try {
      const res = await fetch('/api/inspect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
      });

      const text = await res.text();
      let data: InspectMediaResponse;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`Gateway returned HTTP ${res.status}`);
      }

      if (!res.ok || !data.success || !data.data) {
        throw new Error(data.error?.message || 'Inspection failed');
      }

      setMetadata(data.data);
      setState('SELECTION');
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Unable to inspect media asset');
      setState('ERROR');
    }
  };

  // 4. Action: Dispatch Transcode Job
  const handleStartJob = async (config: {
    format: TargetFormat;
    quality: TargetQuality;
    subtitleTrackIndex?: number;
  }) => {
    setErrorMessage(null);

    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceUrl: url.trim(),
          targetFormat: config.format,
          targetQuality: config.quality,
          extractSubtitleTrackIndex: config.subtitleTrackIndex,
        }),
      });

      const data: CreateJobResponse = await res.json();
      if (!res.ok || !data.success) {
        throw new Error('Failed to dispatch processing job');
      }

      const jobId = data.jobId;
      setActiveJobId(jobId);
      setProgressEvent({
        jobId,
        state: 'queued',
        progress: 0,
        stage: 'Gravitational queue initialized...',
        timestamp: new Date().toISOString(),
      });
      setState('PROCESSING');

      // 5. Connect to Real-Time Server-Sent Events (SSE)
      subscribeToSSE(jobId);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Job dispatch failed');
      setState('ERROR');
    }
  };

  const subscribeToSSE = (jobId: string) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const sse = new EventSource(`/api/jobs/${jobId}/events`);
    eventSourceRef.current = sse;

    sse.addEventListener('progress', (e) => {
      try {
        const parsed: JobProgressEvent = JSON.parse(e.data);
        setProgressEvent(parsed);

        if (parsed.state === 'completed') {
          setState('COMPLETED');
          sse.close();
        } else if (parsed.state === 'failed') {
          setErrorMessage(parsed.error?.message || 'Media processing interrupted');
          setState('ERROR');
          sse.close();
        }
      } catch (err) {
        console.error('SSE parse error:', err);
      }
    });

    sse.onerror = () => {
      // Fallback check
      fetch(`/api/jobs/${jobId}`)
        .then((r) => r.json())
        .then((j) => {
          if (j.state === 'completed') {
            setProgressEvent({
              jobId,
              state: 'completed',
              progress: 100,
              stage: 'Completed',
              result: j.result,
              timestamp: new Date().toISOString(),
            });
            setState('COMPLETED');
            sse.close();
          }
        })
        .catch(() => {});
    };
  };

  const handleReset = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setState('IDLE');
    setUrl('');
    setMetadata(null);
    setActiveJobId(null);
    setProgressEvent(null);
    setErrorMessage(null);
  };

  return (
    <div className="relative w-full h-screen overflow-hidden flex flex-col items-center justify-center">
      {/* Cosmic Event Horizon Backdrop */}
      <SingularityOrb isInspecting={state === 'INSPECTING'} />

      {/* Centerpiece Branding (Discreet, Metallic, Geometric) */}
      <div className="absolute top-12 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2.5 opacity-90 hover:opacity-100 transition-opacity pointer-events-none">
        {/* Minimal Glowing Eclipse Icon */}
        <div className="relative w-4 h-4 rounded-full border border-white/60 bg-gradient-to-tr from-zinc-950 via-zinc-800 to-white shadow-[0_0_12px_rgba(255,255,255,0.7)]" />
        <span className="text-sm font-medium tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white via-zinc-200 to-zinc-500">
          BlackHole
        </span>
      </div>

      {/* Morphing Central Container with Spring Physics */}
      <div className="relative z-20 w-full max-w-lg px-4 flex items-center justify-center">
        <AnimatePresence mode="wait">
          {/* STATE 1: IDLE */}
          {state === 'IDLE' && (
            <motion.div
              key="state-idle"
              layoutId="centralMorphContainer"
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, filter: 'blur(10px)' }}
              transition={{ type: 'spring', stiffness: 350, damping: 30 }}
              className="w-full flex flex-col items-center gap-3"
            >
              {/* Sleek Floating Pill Bar */}
              <div className="w-full flex items-center gap-2 bg-zinc-950/70 backdrop-blur-2xl border border-white/[0.08] hover:border-white/[0.14] rounded-full px-4 py-2.5 shadow-[0_0_60px_-15px_rgba(255,255,255,0.07)] transition-all">
                {/* Central Singularity Pulse Ring */}
                <div className="w-2.5 h-2.5 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.9)] animate-pulse flex-shrink-0" />

                {/* Borderless Input */}
                <input
                  ref={inputRef}
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleInspect()}
                  placeholder="Paste link or press ⌘V anywhere..."
                  className="flex-1 bg-transparent border-none text-xs text-zinc-100 placeholder-zinc-500 outline-none selection:bg-white selection:text-black font-light tracking-tight"
                  autoFocus
                />

                {/* Action: Paste from Clipboard */}
                <button
                  type="button"
                  onClick={handleClipboardPaste}
                  className="px-2.5 py-1 text-[11px] text-zinc-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] rounded-full transition-all cursor-pointer flex items-center gap-1.5 flex-shrink-0"
                  title="Paste from clipboard"
                >
                  <Clipboard className="w-3 h-3" />
                  <span className="hidden sm:inline font-mono">Paste</span>
                </button>

                {/* Submit Action */}
                <button
                  type="button"
                  onClick={() => handleInspect()}
                  disabled={!url.trim()}
                  className="p-1.5 rounded-full bg-white hover:bg-zinc-200 text-black disabled:opacity-20 disabled:hover:bg-white transition-all cursor-pointer disabled:cursor-not-allowed flex-shrink-0"
                  title="Inspect"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Discreet Keyboard Hint */}
              <div className="flex items-center gap-1 text-[11px] text-zinc-600 font-mono tracking-tight">
                <span>press</span>
                <kbd className="px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.06] text-zinc-400">
                  Enter ↵
                </kbd>
                <span>to inspect</span>
              </div>
            </motion.div>
          )}

          {/* STATE 2: INSPECTING (Collapsed Singularity) */}
          {state === 'INSPECTING' && (
            <motion.div
              key="state-inspecting"
              layoutId="centralMorphContainer"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 350, damping: 30 }}
              className="flex flex-col items-center justify-center gap-4"
            >
              {/* Collapsed Circular Singularity with Orbiting Photon Ring */}
              <div className="relative w-16 h-16 rounded-full flex items-center justify-center bg-zinc-950/90 border border-white/[0.1] shadow-[0_0_50px_rgba(255,255,255,0.2)]">
                {/* Orbiting ring */}
                <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-white border-r-indigo-400 animate-spin" />
                <div className="w-4 h-4 rounded-full bg-white shadow-[0_0_20px_rgba(255,255,255,1)] animate-ping" />
              </div>
              <span className="text-xs font-mono text-zinc-400 tracking-wider uppercase animate-pulse">
                Inspecting spacetime...
              </span>
            </motion.div>
          )}

          {/* STATE 3: FORMAT & QUALITY SELECTION DRAWER */}
          {state === 'SELECTION' && metadata && (
            <QualitySelector
              key="state-selection"
              metadata={metadata}
              onSelect={handleStartJob}
              onReset={handleReset}
            />
          )}

          {/* STATE 4 & 5: PROCESSING & COMPLETED / ERROR */}
          {(state === 'PROCESSING' || state === 'COMPLETED') && progressEvent && (
            <ProgressOrb
              key="state-progress"
              event={progressEvent}
              onReset={handleReset}
              onDownloadAgain={() => {
                if (progressEvent.result?.downloadUrl) {
                  window.open(progressEvent.result.downloadUrl, '_blank');
                }
              }}
            />
          )}

          {/* ERROR STATE */}
          {state === 'ERROR' && (
            <motion.div
              key="state-error"
              layoutId="centralMorphContainer"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-sm w-full bg-zinc-950/80 backdrop-blur-2xl border border-rose-500/20 rounded-3xl p-6 shadow-[0_0_60px_-15px_rgba(244,63,94,0.15)] text-center space-y-4"
            >
              <div className="w-12 h-12 mx-auto rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                <CornerDownLeft className="w-5 h-5 rotate-90" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-medium text-white">Event Horizon Repulsion</h4>
                <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                  {errorMessage || 'Unable to pull the requested media stream.'}
                </p>
              </div>
              <button
                onClick={handleReset}
                className="w-full py-2.5 rounded-2xl bg-white/[0.08] hover:bg-white/[0.12] text-white text-xs font-medium transition-colors cursor-pointer"
              >
                Try Another Link
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Minimal Discreet Bottom Indicator */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-4 text-[11px] text-zinc-600 font-mono tracking-tight pointer-events-none">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
          Quantum Stream Engine Active
        </span>
      </div>
    </div>
  );
}
