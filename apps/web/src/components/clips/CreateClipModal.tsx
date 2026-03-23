'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';
import { api } from '@/lib/api';

const MIN_DURATION = 5;
const MAX_DURATION = 120;

interface CreateClipModalProps {
  hlsSrc: string;
  agentId: string;
  streamId: string | null;
  agentName: string;
  onClose: () => void;
  onCreated: (shareId: string) => void;
}

/* ─── Helpers ─── */

function fmtOffset(seekEnd: number, time: number): string {
  const off = Math.max(0, Math.round(seekEnd - time));
  const m = Math.floor(off / 60);
  const s = off % 60;
  return `-${m}:${String(s).padStart(2, '0')}`;
}

function fmtDuration(sec: number): string {
  const s = Math.round(sec);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function pct(time: number, start: number, span: number): number {
  if (span <= 0) return 0;
  return Math.max(0, Math.min(100, ((time - start) / span) * 100));
}

/* ─── Component ─── */

export function CreateClipModal({
  hlsSrc,
  agentId,
  streamId,
  agentName,
  onClose,
  onCreated,
}: CreateClipModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  // Stream state
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCt] = useState(0);
  const [sStart, setSStart] = useState(0);
  const [sEnd, setSEnd] = useState(0);

  // Selection
  const [inPt, setIn] = useState(0);
  const [outPt, setOut] = useState(0);
  const [dragging, setDragging] = useState<'in' | 'out' | null>(null);
  const initRef = useRef(false);

  // Form
  const [title, setTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const span = sEnd - sStart;
  const dur = Math.round(outPt - inPt);

  /* ─── HLS setup ─── */
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !Hls.isSupported()) return;

    const hls = new Hls({
      enableWorker: true,
      lowLatencyMode: false,
      backBufferLength: 300,
      maxBufferLength: 30,
      maxMaxBufferLength: 60,
      liveSyncDurationCount: 3,
      liveDurationInfinity: true,
    });

    hls.loadSource(hlsSrc);
    hls.attachMedia(v);

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      setReady(true);
      v.pause();
    });

    hls.on(Hls.Events.ERROR, (_, d) => {
      if (d.fatal) setError('Failed to load stream');
    });

    hlsRef.current = hls;
    return () => {
      hls.destroy();
      hlsRef.current = null;
    };
  }, [hlsSrc]);

  /* ─── Sync seekable range + current time ─── */
  const syncRange = useCallback(() => {
    const v = videoRef.current;
    if (!v || v.seekable.length === 0) return;
    const s = v.seekable.start(0);
    const e = v.seekable.end(0);
    setSStart(s);
    setSEnd(e);
    setCt(v.currentTime);

    // First time: default to last 30s
    if (!initRef.current && e - s > 2) {
      const defDur = Math.min(30, e - s);
      setOut(e);
      setIn(Math.max(s, e - defDur));
      initRef.current = true;
    }
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTu = () => {
      setCt(v.currentTime);
      syncRange();
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    v.addEventListener('timeupdate', onTu);
    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    // Poll seekable range every 500ms (timeupdate isn't frequent enough)
    const iv = setInterval(syncRange, 500);
    return () => {
      v.removeEventListener('timeupdate', onTu);
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
      clearInterval(iv);
    };
  }, [syncRange]);

  /* ─── Handle drag ─── */
  useEffect(() => {
    if (!dragging || !trackRef.current) return;

    const move = (cx: number) => {
      const r = trackRef.current!.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (cx - r.left) / r.width));
      const t = sStart + ratio * span;
      if (dragging === 'in') {
        setIn(Math.max(sStart, Math.min(t, outPt - MIN_DURATION)));
      } else {
        const cap = Math.min(inPt + MAX_DURATION, sEnd);
        setOut(Math.max(inPt + MIN_DURATION, Math.min(t, cap)));
      }
    };

    const mm = (e: MouseEvent) => move(e.clientX);
    const tm = (e: TouchEvent) => {
      e.preventDefault();
      move(e.touches[0].clientX);
    };
    const up = () => setDragging(null);

    window.addEventListener('mousemove', mm);
    window.addEventListener('mouseup', up);
    window.addEventListener('touchmove', tm, { passive: false });
    window.addEventListener('touchend', up);
    return () => {
      window.removeEventListener('mousemove', mm);
      window.removeEventListener('mouseup', up);
      window.removeEventListener('touchmove', tm);
      window.removeEventListener('touchend', up);
    };
  }, [dragging, sStart, sEnd, span, inPt, outPt]);

  // Seek video to handle position while dragging
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !dragging) return;
    v.currentTime = dragging === 'in' ? inPt : outPt;
  }, [inPt, outPt, dragging]);

  /* ─── Keyboard ─── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const v = videoRef.current;
      if (!v || !ready) return;
      if (e.target instanceof HTMLInputElement) return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          v.paused ? v.play() : v.pause();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          v.currentTime = Math.max(sStart, v.currentTime - 1);
          break;
        case 'ArrowRight':
          e.preventDefault();
          v.currentTime = Math.min(sEnd, v.currentTime + 1);
          break;
        case 'i':
        case 'I':
          e.preventDefault();
          setIn(Math.max(sStart, Math.min(v.currentTime, outPt - MIN_DURATION)));
          break;
        case 'o':
        case 'O':
          e.preventDefault();
          setOut(Math.min(sEnd, Math.max(v.currentTime, inPt + MIN_DURATION)));
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [ready, sStart, sEnd, inPt, outPt]);

  /* ─── Actions ─── */

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    v.paused ? v.play() : v.pause();
  };

  const seekTo = (t: number) => {
    const v = videoRef.current;
    if (v) v.currentTime = t;
  };

  const adjust = (which: 'in' | 'out', delta: number) => {
    if (which === 'in') {
      const n = Math.max(sStart, Math.min(inPt + delta, outPt - MIN_DURATION));
      setIn(n);
      seekTo(n);
    } else {
      const cap = Math.min(inPt + MAX_DURATION, sEnd);
      const n = Math.max(inPt + MIN_DURATION, Math.min(outPt + delta, cap));
      setOut(n);
      seekTo(n);
    }
  };

  const preset = (seconds: number) => {
    const e = sEnd;
    const s = Math.max(sStart, e - seconds);
    setIn(s);
    setOut(e);
    seekTo(s);
  };

  const trackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (dragging) return;
    const r = trackRef.current?.getBoundingClientRect();
    if (!r) return;
    const ratio = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    seekTo(sStart + ratio * span);
  };

  const handleSubmit = async () => {
    if (!title.trim() || title.trim().length < 3) {
      setError('Title must be at least 3 characters');
      return;
    }
    if (dur < MIN_DURATION || dur > MAX_DURATION) {
      setError(`Clip must be ${MIN_DURATION}–${MAX_DURATION}s`);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const offsetFromEnd = Math.round(sEnd - inPt);
      const result = await api<{ shareId: string }>('/clips', {
        method: 'POST',
        body: JSON.stringify({
          agentId,
          streamId: streamId || undefined,
          title: title.trim(),
          duration: dur,
          offsetFromEnd,
        }),
      });
      onCreated(result.shareId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create clip');
      setSubmitting(false);
    }
  };

  /* ─── Render ─── */

  const inPct = pct(inPt, sStart, span);
  const outPct = pct(outPt, sStart, span);
  const headPct = pct(currentTime, sStart, span);
  const validDur = dur >= MIN_DURATION && dur <= MAX_DURATION;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div className="bg-claw-surface border border-claw-border rounded-xl w-full max-w-3xl shadow-2xl shadow-black/60 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-claw-border flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <svg className="w-5 h-5 text-claw-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polygon points="10 8 16 12 10 16 10 8" />
            </svg>
            <h3 className="text-lg font-bold">Clip Editor</h3>
            <span className="text-xs text-claw-text-muted ml-1 hidden sm:inline">
              {agentName}
            </span>
          </div>
          <button onClick={onClose} disabled={submitting} className="text-claw-text-muted hover:text-claw-text transition-colors p-1">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Video Preview */}
          <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
            {!ready && (
              <div className="absolute inset-0 flex items-center justify-center z-10">
                <div className="text-center">
                  <div className="w-10 h-10 mx-auto mb-2 border-2 border-claw-accent/30 border-t-claw-accent rounded-full animate-spin" />
                  <p className="text-sm text-white/60">Loading stream...</p>
                </div>
              </div>
            )}
            <video
              ref={videoRef}
              className="w-full h-full object-contain"
              playsInline
              muted
            />
          </div>

          {/* Transport controls */}
          <div className="flex items-center gap-3">
            <button onClick={() => seekTo(Math.max(sStart, currentTime - 5))} className="p-1.5 rounded-md bg-claw-card border border-claw-border hover:bg-claw-bg transition-colors" title="-5s">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 19 2 12 11 5 11 19" />
                <polygon points="22 19 13 12 22 5 22 19" />
              </svg>
            </button>
            <button onClick={togglePlay} className="p-2 rounded-lg bg-claw-accent text-white hover:bg-claw-accent/90 transition-colors">
              {playing ? (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16" rx="1" />
                  <rect x="14" y="4" width="4" height="16" rx="1" />
                </svg>
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
              )}
            </button>
            <button onClick={() => seekTo(Math.min(sEnd, currentTime + 5))} className="p-1.5 rounded-md bg-claw-card border border-claw-border hover:bg-claw-bg transition-colors" title="+5s">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 19 22 12 13 5 13 19" />
                <polygon points="2 19 11 12 2 5 2 19" />
              </svg>
            </button>

            <div className="flex-1" />

            <span className="text-sm font-mono text-claw-text-muted tabular-nums">
              {fmtOffset(sEnd, currentTime)}
            </span>
            <span className="text-xs text-claw-text-muted/40">
              {Math.round(span)}s available
            </span>
          </div>

          {/* Timeline */}
          <div className="space-y-1">
            <div
              ref={trackRef}
              className="relative h-10 bg-claw-bg rounded-lg cursor-pointer select-none border border-claw-border"
              onClick={trackClick}
            >
              {/* Selected region */}
              <div
                className="absolute top-0 bottom-0 bg-claw-accent/20 border-y border-claw-accent/40"
                style={{ left: `${inPct}%`, width: `${outPct - inPct}%` }}
              />

              {/* Playhead */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-white/80 z-20 pointer-events-none"
                style={{ left: `${headPct}%` }}
              />

              {/* IN handle */}
              <div
                className="absolute top-0 bottom-0 w-3 z-30 cursor-ew-resize group"
                style={{ left: `calc(${inPct}% - 6px)` }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setDragging('in');
                }}
                onTouchStart={(e) => {
                  e.stopPropagation();
                  setDragging('in');
                }}
              >
                <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-1 bg-claw-accent rounded-full group-hover:w-1.5 transition-all" />
                <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-mono text-claw-accent whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                  IN {fmtOffset(sEnd, inPt)}
                </div>
              </div>

              {/* OUT handle */}
              <div
                className="absolute top-0 bottom-0 w-3 z-30 cursor-ew-resize group"
                style={{ left: `calc(${outPct}% - 6px)` }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setDragging('out');
                }}
                onTouchStart={(e) => {
                  e.stopPropagation();
                  setDragging('out');
                }}
              >
                <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-1 bg-claw-accent rounded-full group-hover:w-1.5 transition-all" />
                <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-mono text-claw-accent whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                  OUT {fmtOffset(sEnd, outPt)}
                </div>
              </div>
            </div>

            {/* Labels below timeline */}
            <div className="flex justify-between text-[10px] text-claw-text-muted/50 font-mono px-1">
              <span>{fmtOffset(sEnd, sStart)}</span>
              <span>LIVE</span>
            </div>
          </div>

          {/* Fine controls row */}
          <div className="flex items-center gap-4 flex-wrap">
            {/* IN controls */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-claw-accent w-7">IN</span>
              <button onClick={() => adjust('in', -1)} className="px-2 py-1 text-xs rounded bg-claw-card border border-claw-border hover:bg-claw-bg transition-colors">-1s</button>
              <span className="text-xs font-mono text-claw-text tabular-nums w-12 text-center">{fmtOffset(sEnd, inPt)}</span>
              <button onClick={() => adjust('in', 1)} className="px-2 py-1 text-xs rounded bg-claw-card border border-claw-border hover:bg-claw-bg transition-colors">+1s</button>
            </div>

            {/* OUT controls */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-claw-accent w-7">OUT</span>
              <button onClick={() => adjust('out', -1)} className="px-2 py-1 text-xs rounded bg-claw-card border border-claw-border hover:bg-claw-bg transition-colors">-1s</button>
              <span className="text-xs font-mono text-claw-text tabular-nums w-12 text-center">{fmtOffset(sEnd, outPt)}</span>
              <button onClick={() => adjust('out', 1)} className="px-2 py-1 text-xs rounded bg-claw-card border border-claw-border hover:bg-claw-bg transition-colors">+1s</button>
            </div>

            <div className="flex-1" />

            {/* Duration badge */}
            <div className={`px-3 py-1 rounded-full text-xs font-bold tabular-nums ${validDur ? 'bg-claw-accent/15 text-claw-accent' : 'bg-red-500/15 text-red-400'}`}>
              {fmtDuration(dur)}
            </div>
          </div>

          {/* Presets */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-claw-text-muted">Quick:</span>
            {[15, 30, 60].map((s) => (
              <button
                key={s}
                onClick={() => preset(s)}
                className="px-3 py-1 text-xs font-semibold rounded-md bg-claw-card border border-claw-border hover:border-claw-accent/40 hover:bg-claw-bg transition-all"
              >
                Last {s}s
              </button>
            ))}
            <div className="flex-1" />
            <span className="text-[10px] text-claw-text-muted/40 hidden sm:inline">
              Shortcuts: Space play · I/O set points · Arrow seek
            </span>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 100))}
              placeholder={`Clip from ${agentName}...`}
              className="w-full px-3 py-2 bg-claw-bg border border-claw-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-claw-accent/50 focus:border-claw-accent placeholder:text-claw-text-muted/40"
              disabled={submitting}
            />
            <p className="text-xs text-claw-text-muted/50 mt-1 text-right">{title.length}/100</p>
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-claw-border flex-shrink-0">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-sm font-semibold rounded-lg text-claw-text-muted hover:text-claw-text transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !title.trim() || title.trim().length < 3 || !validDur}
            className="px-6 py-2.5 text-sm font-bold rounded-lg bg-claw-accent text-white hover:bg-claw-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
          >
            {submitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Create Clip
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
