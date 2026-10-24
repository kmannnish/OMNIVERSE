'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clipboard, ArrowRight, Sparkles, AlertTriangle } from 'lucide-react';
import { LuminousExpanseCanvas } from './LuminousExpanseCanvas';
import { RadiantCoreSphere } from './RadiantCoreSphere';
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

export function OmniverseCore() {
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

  // 3. Action: Inspect Media URL ("Aligning with the Expanse")
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
        throw new Error(`Expanse gateway returned HTTP ${res.status}`);
      }

      if (!res.ok || !data.success || !data.data) {
        throw new Error(data.error?.message || 'Unable to probe stream in the expanse');
      }

      setMetadata(data.data);
      setState('SELECTION');
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Unable to align media stream');
      setState('ERROR');
    }
  };

  // 4. Action: Dispatch Transcode Job ("Manifesting Pure Stream")
  const handleStartJob = async (config: {
    format: TargetFormat;
    quality: TargetQuality;
    subtitleTrackIndex?: number;
    thumbnailUrl?: string;
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
          thumbnailUrl: config.thumbnailUrl,
        }),
      });

      const data: CreateJobResponse = await res.json();
      if (!res.ok || !data.success) {
        throw new Error('Failed to initiate manifestation pipeline');
      }

      setActiveJobId(data.jobId);
      // Immediately set optimistic initial progress event so UI transitions with ZERO delay
      setProgressEvent({
        jobId: data.jobId,
        state: 'queued',
        progress: 2,
        stage: 'Aligning stream with the expanse...',
        timestamp: new Date().toISOString(),
      });
      setState('PROCESSING');
      listenToJobEvents(data.jobId);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Manifestation initialization failed');
      setState('ERROR');
    }
  };

  // 5. SSE Real-Time Event Stream Listener
  const listenToJobEvents = (jobId: string) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const sse = new EventSource(`/api/jobs/${jobId}/events`);
    eventSourceRef.current = sse;

    const handleSseMessage = (rawJson: string) => {
      try {
        const payload: JobProgressEvent = JSON.parse(rawJson);
        setProgressEvent(payload);

        if (payload.state === 'completed') {
          setState('COMPLETED');
          sse.close();
        } else if (payload.state === 'failed') {
          setErrorMessage(payload.error?.message || 'Manifestation interrupted');
          setState('ERROR');
          sse.close();
        }
      } catch (err) {
        console.error('Failed to parse SSE payload:', err);
      }
    };

    // Listen to named 'progress' events
    sse.addEventListener('progress', (e: MessageEvent) => {
      handleSseMessage(e.data);
    });

    // Listen to generic unnamed messages
    sse.onmessage = (messageEvent) => {
      handleSseMessage(messageEvent.data);
    };

    sse.onerror = (err) => {
      console.warn('SSE stream disconnected, polling fallback:', err);
      sse.close();

      const pollInterval = setInterval(async () => {
        try {
          const res = await fetch(`/api/jobs/${jobId}`);
          if (res.ok) {
            const data: JobProgressEvent = await res.json();
            setProgressEvent(data);
            if (data.state === 'completed') {
              setState('COMPLETED');
              clearInterval(pollInterval);
            } else if (data.state === 'failed') {
              setErrorMessage(data.error?.message || 'Manifestation failed');
              setState('ERROR');
              clearInterval(pollInterval);
            }
          }
        } catch {
          // Keep polling until terminal state
        }
      }, 1500);
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
    <div className="relative w-full h-screen overflow-hidden flex flex-col items-center justify-center bg-[#06070B]">
      {/* 1. Luminous Expanse Canvas (Chidakash, Floating Light Atoms, Infinite Cosmoses, Cursor Starlight) */}
      <LuminousExpanseCanvas />

      {/* 2. Radiant Core Sphere (The Divine Luminous Horizon) */}
      <RadiantCoreSphere
        isInspecting={state === 'INSPECTING'}
        isProcessing={state === 'PROCESSING'}
      />

      {/* 3. Philosophical Header Wordmark & Celestial Pill Badge */}
      <div className="absolute top-10 sm:top-14 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-2 pointer-events-none select-none text-center">
        {/* Subtle Starlight Pill Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.03] border border-white/[0.08] backdrop-blur-md">
          <div className="w-1.5 h-1.5 rounded-full bg-[#F3E5AB] shadow-[0_0_8px_#F3E5AB] animate-pulse" />
          <span className="text-[10px] sm:text-[11px] font-mono tracking-[0.22em] uppercase text-zinc-400">
            Boundless Streams • One Luminous Core
          </span>
        </div>

        {/* OMNIVERSE Wordmark */}
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-extralight tracking-[0.35em] uppercase text-transparent bg-clip-text bg-gradient-to-b from-white via-zinc-200 to-[#F3E5AB] drop-shadow-[0_0_25px_rgba(243,229,171,0.25)]">
          OMNIVERSE
        </h1>

        {/* Poetic & Philosophical Subtitle */}
        <p className="text-xs sm:text-sm font-light text-zinc-400 tracking-wide italic max-w-sm sm:max-w-md px-4">
          &ldquo;Where infinite streams float like particles in pure light.&rdquo;
        </p>
      </div>

      {/* 4. Weightless Central Interactive Conduit (85% Screen Space Preserved) */}
      <div className="relative z-20 w-full max-w-xl px-4 flex items-center justify-center">
        <AnimatePresence mode="wait">
          {/* STATE 1: IDLE ("The Conduit") */}
          {state === 'IDLE' && (
            <motion.div
              key="state-idle"
              layoutId="centralMorphContainer"
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, filter: 'blur(10px)' }}
              transition={{ type: 'spring', stiffness: 350, damping: 30 }}
              className="w-full flex flex-col items-center gap-4"
            >
              {/* Floating Command Bar ("The Conduit") */}
              <div className="w-full flex items-center gap-3 bg-[#0B0D13]/70 backdrop-blur-2xl border border-white/[0.08] hover:border-[#F3E5AB]/40 rounded-full px-5 py-3 sm:py-3.5 shadow-[0_0_80px_-15px_rgba(243,229,171,0.18)] transition-all">
                {/* Luminous Core Indicator */}
                <div className="w-3 h-3 rounded-full bg-[#F3E5AB] shadow-[0_0_12px_#F3E5AB] animate-pulse flex-shrink-0" />

                {/* Borderless Conduit Input */}
                <input
                  ref={inputRef}
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleInspect()}
                  placeholder="Paste any link from the expanse..."
                  className="flex-1 bg-transparent border-none text-sm sm:text-base text-zinc-100 placeholder-zinc-500 outline-none selection:bg-[#F3E5AB] selection:text-black font-light tracking-tight"
                  autoFocus
                />

                {/* Action: Paste from Clipboard */}
                <button
                  type="button"
                  onClick={handleClipboardPaste}
                  className="px-3 py-1.5 text-xs text-zinc-400 hover:text-[#F3E5AB] bg-white/[0.04] hover:bg-[#F3E5AB]/10 hover:border-[#F3E5AB]/30 border border-white/[0.06] rounded-full transition-all cursor-pointer flex items-center gap-1.5 flex-shrink-0"
                  title="Paste from clipboard"
                >
                  <Clipboard className="w-3.5 h-3.5 text-[#F3E5AB]" />
                  <span className="hidden sm:inline font-mono">Paste</span>
                </button>

                {/* Primary Action Button: "Manifest" */}
                <button
                  type="button"
                  onClick={() => handleInspect()}
                  disabled={!url.trim()}
                  className="px-4 py-2 rounded-full shimmer-celestial-btn text-black font-semibold text-xs tracking-wider uppercase disabled:opacity-25 transition-all cursor-pointer disabled:cursor-not-allowed flex items-center gap-1.5 flex-shrink-0 shadow-[0_0_20px_rgba(243,229,171,0.4)]"
                  title="Manifest"
                >
                  <span>Manifest</span>
                  <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
                </button>
              </div>

              {/* Philosophical Guiding Caption & Keyboard Shortcut */}
              <div className="flex flex-col sm:flex-row items-center gap-2 text-xs text-zinc-500 font-mono tracking-tight text-center">
                <span>Draw any video in its purest form</span>
                <span className="hidden sm:inline text-zinc-700">•</span>
                <div className="flex items-center gap-1">
                  <span>press</span>
                  <kbd className="px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.08] text-zinc-300">
                    Enter ↵
                  </kbd>
                  <span>or paste anywhere</span>
                </div>
              </div>
            </motion.div>
          )}

          {/* STATE 2: INSPECTING (Channeling from Chidakash) */}
          {state === 'INSPECTING' && (
            <motion.div
              key="state-inspecting"
              layoutId="centralMorphContainer"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 350, damping: 30 }}
              className="flex flex-col items-center justify-center gap-5"
            >
              <div className="relative w-20 h-20 rounded-full flex items-center justify-center bg-[#08090E]/90 border border-[#F3E5AB]/40 shadow-[0_0_60px_rgba(243,229,171,0.4)]">
                <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#F3E5AB] border-r-white animate-spin" />
                <div className="w-5 h-5 rounded-full bg-[#F3E5AB] shadow-[0_0_25px_#F3E5AB] animate-ping" />
              </div>
              <span className="text-sm font-mono text-[#F3E5AB]/90 tracking-widest uppercase animate-pulse">
                Aligning with the Expanse...
              </span>
            </motion.div>
          )}

          {/* STATE 3: PURE FORM & RESOLUTION DRAWER */}
          {state === 'SELECTION' && metadata && (
            <QualitySelector
              key="state-selection"
              metadata={metadata}
              onSelect={handleStartJob}
              onReset={handleReset}
            />
          )}

          {/* STATE 4 & 5: PROCESSING & COMPLETED */}
          {(state === 'PROCESSING' || state === 'COMPLETED') && (
            <ProgressOrb
              key="state-progress"
              event={
                progressEvent || {
                  jobId: activeJobId || '',
                  state: 'queued',
                  progress: 2,
                  stage: 'Aligning stream with the expanse...',
                  timestamp: new Date().toISOString(),
                }
              }
              onReset={handleReset}
              onDownloadAgain={() => {
                const downloadUrl = progressEvent?.result?.downloadUrl || (activeJobId ? `/api/jobs/${activeJobId}/download` : undefined);
                if (downloadUrl) {
                  window.open(downloadUrl, '_blank');
                }
              }}
            />
          )}

          {/* ERROR STATE */}
          {state === 'ERROR' && (
            <motion.div
              key="state-error"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 350, damping: 30 }}
              className="max-w-md w-full bg-[#0B0D13]/90 backdrop-blur-3xl border border-rose-500/20 rounded-[2rem] p-7 shadow-[0_0_80px_-10px_rgba(244,63,94,0.2)] flex flex-col items-center text-center space-y-4"
            >
              <div className="w-14 h-14 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shadow-[0_0_30px_rgba(244,63,94,0.3)]">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-white tracking-tight">Stream Alignment Interrupted</h3>
                <p className="text-xs text-zinc-400 leading-relaxed px-2">
                  {errorMessage || 'The stream could not be drawn from the expanse.'}
                </p>
              </div>
              <button
                onClick={handleReset}
                className="px-6 py-2.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-xs font-mono text-white transition-all cursor-pointer"
              >
                Realign Conduit
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 5. Subtle Philosophical Footer Note */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 pointer-events-none select-none text-center">
        <span className="text-[10px] font-mono tracking-[0.25em] text-zinc-600 uppercase">
          Boundless Reach • Radiant Clarity • Aksharbrahm Chidakash
        </span>
      </div>
    </div>
  );
}
