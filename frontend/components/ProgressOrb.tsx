'use client';

import React, { useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Check, ArrowRight, Sparkles, AlertTriangle } from 'lucide-react';
import type { JobProgressEvent } from '@media-suite/shared';

interface ProgressOrbProps {
  event: JobProgressEvent;
  onReset: () => void;
  onDownloadAgain?: () => void;
}

export function ProgressOrb({ event, onReset, onDownloadAgain }: ProgressOrbProps) {
  const downloadTriggeredRef = useRef(false);

  const progressPercent = Math.min(100, Math.max(0, event.progress || 0));

  // Universal download URL (streaming proxy with fallback to S3 presigned)
  const resolvedDownloadUrl = useMemo(() => {
    if (!event.result) return undefined;
    if (event.jobId) return `/api/jobs/${event.jobId}/download`;
    return event.result.downloadUrl;
  }, [event.jobId, event.result]);

  // Automatically trigger download when completed
  useEffect(() => {
    if (event.state === 'completed' && resolvedDownloadUrl && !downloadTriggeredRef.current) {
      downloadTriggeredRef.current = true;
      try {
        const link = document.createElement('a');
        link.href = resolvedDownloadUrl;
        link.download = event.result?.filename || 'manifestation';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (err) {
        console.warn('Auto download bypassed:', err);
      }
    }
  }, [event.state, resolvedDownloadUrl, event.result]);

  const isProcessing = ['queued', 'processing', 'uploading'].includes(event.state);

  return (
    <AnimatePresence mode="wait">
      {/* State: PROCESSING / QUEUED / UPLOADING (Pure Effect Only: No Box, No Text Percentage) */}
      {isProcessing && (
        <motion.div
          key="pure-radial-effect"
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.08, filter: 'blur(12px)' }}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          className="relative flex items-center justify-center select-none pointer-events-none"
        >
          {/* Ambient Cosmic Background Core Glow */}
          <div className="absolute w-80 h-80 sm:w-96 sm:h-96 bg-radial from-[#F3E5AB]/15 via-[#F3E5AB]/[0.03] to-transparent rounded-full blur-3xl pointer-events-none" />

          {/* ========================================================================= */}
          {/* THE PURE EFFECT: A CIRCLE FILLING SMOOTHLY FROM CENTER POINT TO OUTSIDE EDGES */}
          {/* ========================================================================= */}
          <div className="relative w-64 h-64 sm:w-72 sm:h-72 flex items-center justify-center">
            {/* Outer Slow Orbiting Dashed Ring */}
            <div className="absolute -inset-4 rounded-full border border-white/[0.06] border-dashed pointer-events-none animate-[spin_32s_linear_infinite]" />

            {/* The Complete Outer Circle Vessel Horizon */}
            <div className="relative w-full h-full rounded-full flex items-center justify-center bg-[#05060A]/80 border border-[#F3E5AB]/30 shadow-[0_0_60px_rgba(243,229,171,0.2),inset_0_0_50px_rgba(0,0,0,0.9)] overflow-hidden">
              {/* Concentric Horizon Reference Rings at 25%, 50%, 75% */}
              <div
                className={`absolute w-[25%] h-[25%] rounded-full border border-dashed transition-all duration-700 pointer-events-none ${
                  progressPercent >= 25
                    ? 'border-[#F3E5AB]/60 shadow-[0_0_14px_rgba(243,229,171,0.35)]'
                    : 'border-white/[0.06]'
                }`}
              />
              <div
                className={`absolute w-[50%] h-[50%] rounded-full border border-dashed transition-all duration-700 pointer-events-none ${
                  progressPercent >= 50
                    ? 'border-[#F3E5AB]/60 shadow-[0_0_14px_rgba(243,229,171,0.35)]'
                    : 'border-white/[0.06]'
                }`}
              />
              <div
                className={`absolute w-[75%] h-[75%] rounded-full border border-dashed transition-all duration-700 pointer-events-none ${
                  progressPercent >= 75
                    ? 'border-[#F3E5AB]/60 shadow-[0_0_14px_rgba(243,229,171,0.35)]'
                    : 'border-white/[0.06]'
                }`}
              />

              {/* DYNAMIC RADIAL EXPANSION: Fills from center point (0%) out to edges (100%) */}
              <motion.div
                className="absolute rounded-full pointer-events-none flex items-center justify-center"
                style={{
                  background:
                    'radial-gradient(circle, #FFFFFF 0%, #FFF8E7 20%, #F3E5AB 50%, #E5C158 80%, #D97706 100%)',
                  boxShadow:
                    '0 0 45px rgba(243, 229, 171, 0.85), inset 0 0 30px rgba(255, 255, 255, 0.75)',
                }}
                initial={{ width: '0%', height: '0%' }}
                animate={{
                  width: `${Math.max(2, progressPercent)}%`,
                  height: `${Math.max(2, progressPercent)}%`,
                }}
                transition={{
                  type: 'spring',
                  stiffness: 100,
                  damping: 18,
                  restDelta: 0.001,
                }}
              >
                {/* Glowing Wavefront Leading Edge at the expanding boundary */}
                <div className="absolute inset-0 rounded-full border-2 border-white/95 shadow-[0_0_20px_#FFFFFF] animate-pulse" />
              </motion.div>

              {/* Liquid Starlight Micro-Ripples pulsing outward from center point */}
              {progressPercent > 0 && progressPercent < 100 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-20 h-20 rounded-full border border-white/40 animate-ping opacity-30" />
                </div>
              )}

              {/* Center Focal Point: The Paramanu Singularity */}
              <div className="absolute w-2.5 h-2.5 rounded-full bg-white shadow-[0_0_15px_#FFFFFF,0_0_30px_#F3E5AB] z-10 pointer-events-none" />
            </div>
          </div>
        </motion.div>
      )}

      {/* State: COMPLETED (Transcendental Realization & Download Action) */}
      {event.state === 'completed' && event.result && (
        <motion.div
          key="completed-card"
          initial={{ scale: 0.88, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 380, damping: 25 }}
          className="max-w-md w-full mx-auto bg-[#07080D]/90 backdrop-blur-3xl border border-white/[0.08] hover:border-[#F3E5AB]/30 rounded-[2.5rem] p-7 sm:p-9 shadow-[0_0_100px_-20px_rgba(243,229,171,0.22)] relative z-20 flex flex-col items-center justify-center space-y-6 text-center"
        >
          {/* Luminous Check Emblem with Outward Expanding Mandala */}
          <div className="relative w-20 h-20 mx-auto rounded-full bg-[#F3E5AB]/10 border border-[#F3E5AB]/40 flex items-center justify-center shadow-[0_0_50px_rgba(243,229,171,0.35)]">
            <div className="absolute inset-0 rounded-full border border-white/20 animate-ping opacity-30" />
            <Check className="w-9 h-9 text-[#F3E5AB] stroke-[2.5]" />
          </div>

          {/* Filename & Spec Metadata */}
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[10px] font-mono uppercase tracking-widest">
              <Sparkles className="w-3 h-3 text-emerald-400" />
              <span>Manifestation Complete</span>
            </div>

            <h4
              className="text-base sm:text-lg font-medium text-white tracking-tight truncate px-2"
              title={event.result.filename}
            >
              {event.result.filename}
            </h4>

            {/* Format Specs Pill */}
            <div className="flex items-center justify-center gap-2 text-xs font-mono text-[#F3E5AB]/90">
              <span>{(event.result.fileSize / (1024 * 1024)).toFixed(1)} MB</span>
              <span>•</span>
              <span className="uppercase">{event.result.mimeType.split('/')[1] || 'MEDIA'}</span>
              <span>•</span>
              <span className="text-emerald-400">Pure Form</span>
            </div>
          </div>

          {/* Primary Action Buttons */}
          <div className="space-y-2.5 pt-2 w-full">
            <a
              href={resolvedDownloadUrl}
              download={event.result.filename}
              onClick={onDownloadAgain}
              className="w-full py-4 rounded-2xl shimmer-celestial-btn text-black font-semibold text-xs tracking-widest uppercase transition-all shadow-[0_0_40px_rgba(243,229,171,0.38)] flex items-center justify-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4 text-black stroke-[2.5]" />
              <span>Receive Manifestation</span>
            </a>

            <button
              type="button"
              onClick={onReset}
              className="w-full py-3 rounded-2xl text-xs font-mono text-zinc-400 hover:text-white transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span>Draw Another Stream from Expanse</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </motion.div>
      )}

      {/* State: FAILED / ERROR */}
      {event.state === 'failed' && (
        <motion.div
          key="failed-card"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="max-w-md w-full mx-auto bg-[#07080D]/90 backdrop-blur-3xl border border-rose-500/20 rounded-[2.5rem] p-7 shadow-[0_0_80px_rgba(244,63,94,0.15)] flex flex-col items-center justify-center space-y-4 text-center"
        >
          <div className="w-16 h-16 mx-auto rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shadow-[0_0_30px_rgba(244,63,94,0.2)]">
            <AlertTriangle className="w-7 h-7" />
          </div>

          <div className="space-y-1">
            <h4 className="text-sm font-medium text-rose-300">Conduit Interrupted</h4>
            <p className="text-xs text-zinc-400 line-clamp-3 leading-relaxed px-2">
              {event.error?.message || 'The stream could not be drawn from the expanse.'}
            </p>
          </div>

          <button
            type="button"
            onClick={onReset}
            className="w-full py-3 rounded-2xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-xs font-mono text-white transition-all cursor-pointer"
          >
            Realign Conduit
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
