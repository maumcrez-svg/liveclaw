'use client';

import { useEffect, useRef, useState } from 'react';
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

function fmtSec(sec: number): string {
  const s = Math.round(Math.abs(sec));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

function pct(t: number, start: number, span: number): number {
  if (span <= 0) return 0;
  return Math.max(0, Math.min(100, ((t - start) / span) * 100));
}

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

  /* ─── state ─── */
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [ct, setCt] = useState(0);

  // Frozen timeline bounds — set once, never move
  const [sStart, setSStart] = useState(0);
  const [sEnd, setSEnd] = useState(0);
  const frozenRef = useRef(false);

  // Selection handles
  const [inPt, setIn] = useState(0);
  const [outPt, setOut] = useState(0);
  const [dragging, setDragging] = useState<'in' | 'out' | null>(null);

  // Form
  const [title, setTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const span = sEnd - sStart;
  const dur = Math.round(outPt - inPt);
  const validDur = dur >= MIN_DURATION && dur <= MAX_DURATION;

  /* ─── Mute main player on mount, restore on unmount ─── */
  useEffect(() => {
    const others: { el: HTMLVideoElement; wasMuted: boolean }[] = [];
    document.querySelectorAll('video').forEach((v) => {
      if (v !== videoRef.current) {
        others.push({ el: v, wasMuted: v.muted });
        v.muted = true;
      }
    });
    return () => {
      others.forEach(({ el, wasMuted }) => {
        el.muted = wasMuted;
      });
    };
  }, []);

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

    hls.on(Hls.Events.MANIFEST_PARSED, () => v.pause());
    hls.on(Hls.Events.ERROR, (_, d) => {
      if (d.fatal) setError('Failed to load stream');
    });

    hlsRef.current = hls;
    return () => {
      hls.destroy();
      hlsRef.current = null;
    };
  }, [hlsSrc]);

  /* ─── Freeze seekable range once ─── */
  useEffect(() => {
    if (frozenRef.current) return;
    const iv = setInterval(() => {
      const v = videoRef.current;
      if (!v || v.seekable.length === 0) return;
      const s = v.seekable.start(0);
      const e = v.seekable.end(0);
      if (e - s < 5) return;

      setSStart(s);
      setSEnd(e);
      const def = Math.min(30, e - s);
      setOut(e);
      setIn(Math.max(s, e - def));
      frozenRef.current = true;
      setReady(true);
      v.pause();
      clearInterval(iv);
    }, 200);
    return () => clearInterval(iv);
  }, []);

  /* ─── Current time tracking (only ct, not bounds) ─── */
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const upd = () => setCt(v.currentTime);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    v.addEventListener('timeupdate', upd);
    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    return () => {
      v.removeEventListener('timeupdate', upd);
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
    };
  }, []);

  /* ─── Drag logic ─── */
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

  // Seek preview while dragging
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !dragging) return;
    v.currentTime = dragging === 'in' ? inPt : outPt;
  }, [inPt, outPt, dragging]);

  /* ─── Keyboard ─── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const v = videoRef.current;
      if (!v || !ready || e.target instanceof HTMLInputElement) return;
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
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [ready, sStart, sEnd]);

  /* ─── Actions ─── */
  const seekTo = (t: number) => {
    if (videoRef.current) videoRef.current.currentTime = t;
  };

  const togglePlay = () => {
    const v = videoRef.current;
    if (v) v.paused ? v.play() : v.pause();
  };

  const preset = (sec: number) => {
    const e = sEnd;
    const s = Math.max(sStart, e - sec);
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
    if (!validDur) {
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

  /* ─── Derived ─── */
  const inPct = pct(inPt, sStart, span);
  const outPct = pct(outPt, sStart, span);
  const headPct = pct(ct, sStart, span);

  /* ─── Handle component ─── */
  const Handle = ({
    side,
    pos,
  }: {
    side: 'in' | 'out';
    pos: number;
  }) => (
    <div
      className="absolute top-0 bottom-0 z-30 cursor-ew-resize"
      style={{
        left: `calc(${pos}% - 8px)`,
        width: '16px',
      }}
      onMouseDown={(e) => {
        e.stopPropagation();
        setDragging(side);
      }}
      onTouchStart={(e) => {
        e.stopPropagation();
        setDragging(side);
      }}
    >
      {/* Visible bar */}
      <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[5px] bg-claw-accent rounded-full shadow-sm shadow-black/40 flex items-center justify-center">
        {/* Grip dots */}
        <div className="flex flex-col gap-[3px]">
          <div className="w-[3px] h-[3px] rounded-full bg-white/70" />
          <div className="w-[3px] h-[3px] rounded-full bg-white/70" />
          <div className="w-[3px] h-[3px] rounded-full bg-white/70" />
        </div>
      </div>
    </div>
  );

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
          </div>
          <button onClick={onClose} disabled={submitting} className="text-claw-text-muted hover:text-claw-text transition-colors p-1">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Video */}
          <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
            {!ready && (
              <div className="absolute inset-0 flex items-center justify-center z-10">
                <div className="text-center">
                  <div className="w-10 h-10 mx-auto mb-2 border-2 border-claw-accent/30 border-t-claw-accent rounded-full animate-spin" />
                  <p className="text-sm text-white/60">Loading stream...</p>
                </div>
              </div>
            )}
            <video ref={videoRef} className="w-full h-full object-contain" playsInline />
          </div>

          {/* Transport */}
          <div className="flex items-center gap-3">
            <button onClick={() => seekTo(Math.max(sStart, ct - 5))} className="p-1.5 rounded-md bg-claw-card border border-claw-border hover:bg-claw-bg transition-colors">
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
            <button onClick={() => seekTo(Math.min(sEnd, ct + 5))} className="p-1.5 rounded-md bg-claw-card border border-claw-border hover:bg-claw-bg transition-colors">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 19 22 12 13 5 13 19" />
                <polygon points="2 19 11 12 2 5 2 19" />
              </svg>
            </button>
            <div className="flex-1" />
            <span className="text-sm font-mono text-claw-text-muted tabular-nums">
              -{fmtSec(sEnd - ct)}
            </span>
          </div>

          {/* ═══ Timeline bar ═══ */}
          <div>
            <div
              ref={trackRef}
              className="relative h-12 bg-claw-bg rounded-lg cursor-pointer select-none border border-claw-border overflow-hidden"
              onClick={trackClick}
            >
              {/* Selected region */}
              <div
                className="absolute top-0 bottom-0 bg-claw-accent/20"
                style={{ left: `${inPct}%`, width: `${Math.max(0, outPct - inPct)}%` }}
              >
                {/* Top/bottom accent edges */}
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-claw-accent/60" />
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-claw-accent/60" />

                {/* Duration label centered in selection */}
                {outPct - inPct > 8 && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className={`text-xs font-bold tabular-nums px-2 py-0.5 rounded-full ${validDur ? 'bg-claw-accent/30 text-claw-accent' : 'bg-red-500/30 text-red-400'}`}>
                      {fmtSec(dur)}
                    </span>
                  </div>
                )}
              </div>

              {/* Playhead */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-white z-20 pointer-events-none"
                style={{ left: `${headPct}%` }}
              >
                <div className="absolute -top-0 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-white rounded-full shadow" />
              </div>

              {/* Handles */}
              <Handle side="in" pos={inPct} />
              <Handle side="out" pos={outPct} />
            </div>

            {/* Time labels */}
            <div className="flex justify-between text-[10px] text-claw-text-muted/50 font-mono mt-1 px-0.5">
              <span>-{fmtSec(span)}</span>
              <span>LIVE</span>
            </div>
          </div>

          {/* Presets + duration */}
          <div className="flex items-center gap-2 flex-wrap">
            {[15, 30, 60].map((s) => (
              <button
                key={s}
                onClick={() => preset(s)}
                disabled={span < s}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-claw-card border border-claw-border hover:border-claw-accent/40 hover:bg-claw-bg disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                Last {s}s
              </button>
            ))}
            <div className="flex-1" />
            {!validDur && dur > 0 && (
              <span className="text-xs text-red-400">
                {dur < MIN_DURATION ? `Min ${MIN_DURATION}s` : `Max ${MAX_DURATION}s`}
              </span>
            )}
          </div>

          {/* Title */}
          <div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 100))}
              placeholder={`Name this clip...`}
              className="w-full px-3 py-2.5 bg-claw-bg border border-claw-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-claw-accent/50 focus:border-claw-accent placeholder:text-claw-text-muted/40"
              disabled={submitting}
            />
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-claw-border flex-shrink-0">
          <button onClick={onClose} disabled={submitting} className="px-4 py-2 text-sm font-semibold rounded-lg text-claw-text-muted hover:text-claw-text transition-colors">
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
              'Create Clip'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
