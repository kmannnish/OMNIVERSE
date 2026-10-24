'use client';

import React, { useEffect, useState, useRef } from 'react';
import {
  Download,
  CheckCircle2,
  AlertCircle,
  Clock,
  Gauge,
  Film,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import type { JobProgressEvent, JobState } from '@media-suite/shared';

interface LiveProgressTrackerProps {
  jobId: string;
  onReset: () => void;
}

export function LiveProgressTracker({ jobId, onReset }: LiveProgressTrackerProps) {
  const [eventData, setEventData] = useState<JobProgressEvent>({
    jobId,
    state: 'queued',
    progress: 0,
    stage: 'Connecting to real-time event pipeline...',
    timestamp: new Date().toISOString(),
  });
  const [copied, setCopied] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'closed'>('connecting');
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    // Open Server-Sent Events (SSE) connection to backend
    const eventSource = new EventSource(`/api/jobs/${jobId}/events`);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setConnectionStatus('connected');
    };

    eventSource.addEventListener('progress', (e) => {
      try {
        const parsed: JobProgressEvent = JSON.parse(e.data);
        setEventData(parsed);

        if (parsed.state === 'completed' || parsed.state === 'failed') {
          eventSource.close();
          setConnectionStatus('closed');
        }
      } catch (err) {
        console.error('[SSE] Failed to parse progress event:', err);
      }
    });

    eventSource.onerror = (err) => {
      console.warn('[SSE] EventSource connection issue:', err);
      // Fallback: Check if job completed via standard REST API
      fetch(`/api/jobs/${jobId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.state === 'completed') {
            setEventData({
              jobId,
              state: 'completed',
              progress: 100,
              stage: 'Completed',
              result: data.result,
              timestamp: new Date().toISOString(),
            });
            eventSource.close();
            setConnectionStatus('closed');
          } else if (data.state === 'failed') {
            setEventData({
              jobId,
              state: 'failed',
              progress: 0,
              stage: 'Failed',
              error: data.error,
              timestamp: new Date().toISOString(),
            });
            eventSource.close();
            setConnectionStatus('closed');
          }
        })
        .catch(() => {});
    };

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [jobId]);

  const copyToClipboard = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes) return 'N/A';
    const mb = bytes / (1024 * 1024);
    if (mb > 1024) return `${(mb / 1024).toFixed(2)} GB`;
    return `${mb.toFixed(2)} MB`;
  };

  const getStateBadge = (state: JobState) => {
    switch (state) {
      case 'queued':
        return (
          <span className="px-3 py-1 bg-amber-500/15 border border-amber-500/30 text-amber-400 rounded-full text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 animate-pulse">
            <Clock className="w-3.5 h-3.5" /> Queued
          </span>
        );
      case 'processing':
        return (
          <span className="px-3 py-1 bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 rounded-full text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Processing
          </span>
        );
      case 'uploading':
        return (
          <span className="px-3 py-1 bg-purple-500/15 border border-purple-500/30 text-purple-400 rounded-full text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" /> S3 Uploading
          </span>
        );
      case 'completed':
        return (
          <span className="px-3 py-1 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 rounded-full text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" /> Ready For Download
          </span>
        );
      case 'failed':
        return (
          <span className="px-3 py-1 bg-rose-500/15 border border-rose-500/30 text-rose-400 rounded-full text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" /> Pipeline Failed
          </span>
        );
    }
  };

  return (
    <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
            <Gauge className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">Live Execution Pipeline</h2>
            <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
              <span>Job ID:</span>
              <span className="font-mono text-slate-300">{jobId}</span>
              <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
              <span className={connectionStatus === 'connected' ? 'text-emerald-400' : 'text-slate-500'}>
                SSE {connectionStatus}
              </span>
            </div>
          </div>
        </div>
        {getStateBadge(eventData.state)}
      </div>

      {/* Progress Bar Container */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-300 font-medium">{eventData.stage}</span>
          <span className="font-mono text-sm font-bold text-white">{eventData.progress}%</span>
        </div>

        <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              eventData.state === 'failed'
                ? 'bg-rose-500'
                : eventData.state === 'completed'
                ? 'bg-emerald-500'
                : 'bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-400 animate-pulse'
            }`}
            style={{ width: `${Math.max(3, eventData.progress)}%` }}
          />
        </div>
      </div>

      {/* Real-time Telemetry Metrics (When processing) */}
      {eventData.metrics && eventData.state === 'processing' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          <div className="p-3 bg-slate-950/60 border border-slate-800/60 rounded-xl">
            <span className="text-[11px] text-slate-500 font-medium block">Speed Factor</span>
            <span className="text-base font-bold text-indigo-400 font-mono">
              {eventData.metrics.speed || '1.0x'}
            </span>
          </div>

          <div className="p-3 bg-slate-950/60 border border-slate-800/60 rounded-xl">
            <span className="text-[11px] text-slate-500 font-medium block">Frame Rate</span>
            <span className="text-base font-bold text-white font-mono">
              {eventData.metrics.fps ? `${eventData.metrics.fps} fps` : '--'}
            </span>
          </div>

          <div className="p-3 bg-slate-950/60 border border-slate-800/60 rounded-xl">
            <span className="text-[11px] text-slate-500 font-medium block">Processed Time</span>
            <span className="text-base font-bold text-white font-mono">
              {eventData.metrics.currentTime || '00:00:00'}
            </span>
          </div>

          <div className="p-3 bg-slate-950/60 border border-slate-800/60 rounded-xl">
            <span className="text-[11px] text-slate-500 font-medium block">Estimated ETA</span>
            <span className="text-base font-bold text-amber-400 font-mono">
              {eventData.metrics.etaSeconds !== undefined ? `${eventData.metrics.etaSeconds}s` : 'Calculating...'}
            </span>
          </div>
        </div>
      )}

      {/* Completion & Download Card */}
      {eventData.state === 'completed' && eventData.result && (
        <div className="p-5 bg-gradient-to-br from-emerald-500/10 via-slate-900 to-slate-950 border border-emerald-500/30 rounded-2xl space-y-4 animate-fadeIn">
          <div className="flex items-start justify-between flex-wrap gap-2">
            <div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-semibold text-white">Transcoding & S3 Upload Succeeded</h3>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Asset stored in S3 object storage with pre-signed CDN download disposition.
              </p>
            </div>
            {eventData.result.isStreamCopy && (
              <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-lg text-xs font-medium">
                ⚡ Stream Copied (-c copy)
              </span>
            )}
          </div>

          {/* Asset details */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 p-3 bg-slate-950/70 border border-slate-800 rounded-xl text-xs">
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-semibold">Filename</span>
              <span className="text-slate-200 font-medium truncate block">{eventData.result.filename}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-semibold">File Size</span>
              <span className="text-slate-200 font-medium">{formatBytes(eventData.result.fileSize)}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-semibold">MIME Type</span>
              <span className="text-slate-200 font-mono">{eventData.result.mimeType}</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
            <a
              href={eventData.result.downloadUrl}
              download={eventData.result.filename}
              className="flex-1 py-3 px-5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25"
            >
              <Download className="w-4 h-4" />
              <span>Download High-Speed Media Asset</span>
            </a>

            <button
              onClick={() => copyToClipboard(eventData.result!.downloadUrl)}
              className="py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 border border-slate-700 cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Copied' : 'Copy Signed URL'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Failure Card */}
      {eventData.state === 'failed' && (
        <div className="p-5 bg-rose-500/10 border border-rose-500/30 rounded-2xl space-y-3">
          <div className="flex items-center gap-2 text-rose-400 font-semibold text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>Job Failed: {eventData.error?.code || 'PIPELINE_ERROR'}</span>
          </div>
          <p className="text-xs text-rose-300 leading-relaxed">
            {eventData.error?.message || 'The media processing pipeline encountered an unrecoverable error.'}
          </p>
          {eventData.error?.details && (
            <pre className="p-3 bg-slate-950 rounded-xl text-[11px] text-slate-400 font-mono overflow-x-auto max-h-36">
              {eventData.error.details}
            </pre>
          )}
        </div>
      )}

      {/* Reset CTA */}
      <div className="pt-2 flex justify-end">
        <button
          onClick={onReset}
          className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Process another file</span>
        </button>
      </div>
    </div>
  );
}
