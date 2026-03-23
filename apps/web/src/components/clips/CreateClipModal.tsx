'use client';

import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { api } from '@/lib/api';

const MIN_DURATION = 5;
const MAX_DURATION = 120;

interface Props {
  hlsSrc: string;
  agentId: string;
  streamId: string | null;
  agentName: string;
  onClose: () => void;
  onCreated: (shareId: string) => void;
}

function fmtSec(s: number): string {
  const abs = Math.round(Math.abs(s));
  return `${Math.floor(abs / 60)}:${String(abs % 60).padStart(2, '0')}`;
}

function pct(t: number, s: number, span: number): number {
  return span <= 0 ? 0 : Math.max(0, Math.min(100, ((t - s) / span) * 100));
}

export function CreateClipModal({ hlsSrc, agentId, streamId, agentName, onClose, onCreated }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [ct, setCt] = useState(0);

  const [sStart, setSStart] = useState(0);
  const [sEnd, setSEnd] = useState(0);
  const frozenRef = useRef(false);

  const [inPt, setIn] = useState(0);
  const [outPt, setOut] = useState(0);
  const [dragging, setDragging] = useState<'in' | 'out' | null>(null);

  const [title, setTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const span = sEnd - sStart;
  const dur = Math.round(outPt - inPt);
  const valid = dur >= MIN_DURATION && dur <= MAX_DURATION;

  /* ── Mute main player ── */
  useEffect(() => {
    const saved: { el: HTMLVideoElement; m: boolean }[] = [];
    document.querySelectorAll('video').forEach((v) => {
      if (v !== videoRef.current) {
        saved.push({ el: v, m: v.muted });
        v.muted = true;
      }
    });
    return () => saved.forEach(({ el, m }) => { el.muted = m; });
  }, []);

  /* ── HLS ── */
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
    hls.on(Hls.Events.ERROR, (_, d) => { if (d.fatal) setError('Failed to load stream'); });
    hlsRef.current = hls;
    return () => { hls.destroy(); hlsRef.current = null; };
  }, [hlsSrc]);

  /* ── Freeze range once ── */
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
      const d = Math.min(30, e - s);
      setOut(e);
      setIn(Math.max(s, e - d));
      frozenRef.current = true;
      setReady(true);
      // Seek to start of default selection
      v.currentTime = Math.max(s, e - d);
      v.pause();
      clearInterval(iv);
    }, 200);
    return () => clearInterval(iv);
  }, []);

  /* ── Time tracking + confine playback to selection ── */
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTu = () => {
      setCt(v.currentTime);
      // Stop at OUT point
      if (!v.paused && v.currentTime >= outPt) {
        v.pause();
        v.currentTime = outPt;
      }
    };
    const onPlay = () => {
      setPlaying(true);
      // If playhead is outside selection or at OUT, jump to IN
      if (v.currentTime < inPt - 0.5 || v.currentTime >= outPt - 0.3) {
        v.currentTime = inPt;
      }
    };
    const onPause = () => setPlaying(false);
    v.addEventListener('timeupdate', onTu);
    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    return () => {
      v.removeEventListener('timeupdate', onTu);
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
    };
  }, [inPt, outPt]);

  /* ── Drag ── */
  useEffect(() => {
    if (!dragging || !trackRef.current) return;
    const move = (cx: number) => {
      const r = trackRef.current!.getBoundingClientRect();
      const t = sStart + Math.max(0, Math.min(1, (cx - r.left) / r.width)) * span;
      if (dragging === 'in') setIn(Math.max(sStart, Math.min(t, outPt - MIN_DURATION)));
      else setOut(Math.max(inPt + MIN_DURATION, Math.min(t, Math.min(inPt + MAX_DURATION, sEnd))));
    };
    const mm = (e: MouseEvent) => move(e.clientX);
    const tm = (e: TouchEvent) => { e.preventDefault(); move(e.touches[0].clientX); };
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

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !dragging) return;
    v.currentTime = dragging === 'in' ? inPt : outPt;
  }, [inPt, outPt, dragging]);

  /* ── Keyboard ── */
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const v = videoRef.current;
      if (!v || !ready || e.target instanceof HTMLInputElement) return;
      if (e.key === ' ') { e.preventDefault(); v.paused ? v.play() : v.pause(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); v.currentTime = Math.max(sStart, v.currentTime - 1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); v.currentTime = Math.min(sEnd, v.currentTime + 1); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [ready, sStart, sEnd]);

  /* ── Actions ── */
  const seekTo = (t: number) => { if (videoRef.current) videoRef.current.currentTime = t; };
  const togglePlay = () => { const v = videoRef.current; if (v) v.paused ? v.play() : v.pause(); };
  const preset = (s: number) => { const e = sEnd; const st = Math.max(sStart, e - s); setIn(st); setOut(e); seekTo(st); };

  const trackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (dragging) return;
    const r = trackRef.current?.getBoundingClientRect();
    if (!r) return;
    seekTo(sStart + Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * span);
  };

  const handleSubmit = async () => {
    if (!title.trim() || title.trim().length < 3) { setError('Title must be at least 3 characters'); return; }
    if (!valid) { setError(`Clip must be ${MIN_DURATION}–${MAX_DURATION}s`); return; }
    setSubmitting(true);
    setError(null);
    try {
      const result = await api<{ shareId: string }>('/clips', {
        method: 'POST',
        body: JSON.stringify({
          agentId,
          streamId: streamId || undefined,
          title: title.trim(),
          duration: dur,
          offsetFromEnd: Math.round(sEnd - inPt),
        }),
      });
      onCreated(result.shareId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create clip');
      setSubmitting(false);
    }
  };

  const inPct = pct(inPt, sStart, span);
  const outPct = pct(outPt, sStart, span);
  const headPct = pct(ct, sStart, span);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={(e) => { if (e.target === e.currentTarget && !submitting) onClose(); }}>
      <div className="bg-claw-surface border border-claw-border rounded-xl w-full max-w-3xl shadow-2xl shadow-black/60 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-claw-border flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <svg className="w-5 h-5 text-claw-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polygon points="10 8 16 12 10 16 10 8" /></svg>
            <h3 className="text-lg font-bold">Clip Editor</h3>
          </div>
          <button onClick={onClose} disabled={submitting} className="text-claw-text-muted hover:text-claw-text transition-colors p-1">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Video */}
          <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
            {!ready && (
              <div className="absolute inset-0 flex items-center justify-center z-10">
                <div className="w-10 h-10 border-2 border-claw-accent/30 border-t-claw-accent rounded-full animate-spin" />
              </div>
            )}
            <video ref={videoRef} className="w-full h-full object-contain" playsInline />
          </div>

          {/* Transport */}
          <div className="flex items-center gap-3">
            <button onClick={() => seekTo(Math.max(inPt, ct - 5))} className="p-1.5 rounded-md bg-claw-card border border-claw-border hover:bg-claw-bg transition-colors">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 19 2 12 11 5 11 19" /><polygon points="22 19 13 12 22 5 22 19" /></svg>
            </button>
            <button onClick={togglePlay} className="p-2 rounded-lg bg-claw-accent text-white hover:bg-claw-accent/90 transition-colors">
              {playing ? (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
              )}
            </button>
            <button onClick={() => seekTo(Math.min(outPt, ct + 5))} className="p-1.5 rounded-md bg-claw-card border border-claw-border hover:bg-claw-bg transition-colors">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 19 22 12 13 5 13 19" /><polygon points="2 19 11 12 2 5 2 19" /></svg>
            </button>
            <div className="flex-1" />
            <span className="text-sm font-mono text-claw-text-muted tabular-nums">-{fmtSec(sEnd - ct)}</span>
          </div>

          {/* ═══ Timeline ═══ */}
          <div>
            <div
              ref={trackRef}
              className="relative h-12 bg-claw-bg rounded-lg cursor-pointer select-none border border-claw-border/60 overflow-hidden"
              onClick={trackClick}
            >
              {/* Dimmed regions outside selection */}
              <div className="absolute top-0 bottom-0 left-0 bg-black/30" style={{ width: `${inPct}%` }} />
              <div className="absolute top-0 bottom-0 right-0 bg-black/30" style={{ width: `${100 - outPct}%` }} />

              {/* Selected region — clear with accent borders */}
              <div className="absolute top-0 bottom-0" style={{ left: `${inPct}%`, width: `${Math.max(0, outPct - inPct)}%` }}>
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-claw-accent" />
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-claw-accent" />
                {/* Duration centered */}
                {outPct - inPct > 6 && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className={`text-[11px] font-bold tabular-nums px-2 py-0.5 rounded ${valid ? 'text-white/70' : 'text-red-400'}`}>
                      {fmtSec(dur)}
                    </span>
                  </div>
                )}
              </div>

              {/* Playhead */}
              <div className="absolute top-0 bottom-0 w-0.5 bg-white z-20 pointer-events-none transition-[left] duration-75" style={{ left: `${headPct}%` }}>
                <div className="absolute -top-px left-1/2 -translate-x-1/2 w-3 h-3 bg-white rounded-full shadow-md shadow-black/50 border border-white/80" />
              </div>

              {/* Left handle */}
              <div
                className="absolute top-0 bottom-0 z-30 cursor-ew-resize touch-none"
                style={{ left: `calc(${inPct}% - 10px)`, width: '20px' }}
                onMouseDown={(e) => { e.stopPropagation(); setDragging('in'); }}
                onTouchStart={(e) => { e.stopPropagation(); setDragging('in'); }}
              >
                <div className="absolute top-1 bottom-1 left-1/2 -translate-x-1/2 w-[6px] bg-claw-accent rounded-sm shadow shadow-black/40 flex items-center justify-center hover:w-[8px] active:w-[8px] transition-all">
                  <div className="flex flex-col gap-[2px]"><div className="w-[2px] h-[2px] rounded-full bg-white/80" /><div className="w-[2px] h-[2px] rounded-full bg-white/80" /><div className="w-[2px] h-[2px] rounded-full bg-white/80" /></div>
                </div>
              </div>

              {/* Right handle */}
              <div
                className="absolute top-0 bottom-0 z-30 cursor-ew-resize touch-none"
                style={{ left: `calc(${outPct}% - 10px)`, width: '20px' }}
                onMouseDown={(e) => { e.stopPropagation(); setDragging('out'); }}
                onTouchStart={(e) => { e.stopPropagation(); setDragging('out'); }}
              >
                <div className="absolute top-1 bottom-1 left-1/2 -translate-x-1/2 w-[6px] bg-claw-accent rounded-sm shadow shadow-black/40 flex items-center justify-center hover:w-[8px] active:w-[8px] transition-all">
                  <div className="flex flex-col gap-[2px]"><div className="w-[2px] h-[2px] rounded-full bg-white/80" /><div className="w-[2px] h-[2px] rounded-full bg-white/80" /><div className="w-[2px] h-[2px] rounded-full bg-white/80" /></div>
                </div>
              </div>
            </div>

            <div className="flex justify-between text-[10px] text-claw-text-muted/40 font-mono mt-1 px-0.5">
              <span>-{fmtSec(span)}</span>
              <span>LIVE</span>
            </div>
          </div>

          {/* Presets */}
          <div className="flex items-center gap-2 flex-wrap">
            {[15, 30, 60].map((s) => (
              <button key={s} onClick={() => preset(s)} disabled={span < s} className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-claw-card border border-claw-border hover:border-claw-accent/40 hover:bg-claw-bg disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                Last {s}s
              </button>
            ))}
            {!valid && dur > 0 && <span className="text-xs text-red-400 ml-auto">{dur < MIN_DURATION ? `Min ${MIN_DURATION}s` : `Max ${MAX_DURATION}s`}</span>}
          </div>

          {/* Title */}
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, 100))}
            placeholder="Name this clip..."
            className="w-full px-3 py-2.5 bg-claw-bg border border-claw-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-claw-accent/50 focus:border-claw-accent placeholder:text-claw-text-muted/40"
            disabled={submitting}
          />

          {error && <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-claw-border flex-shrink-0">
          <button onClick={onClose} disabled={submitting} className="px-4 py-2 text-sm font-semibold rounded-lg text-claw-text-muted hover:text-claw-text transition-colors">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !title.trim() || title.trim().length < 3 || !valid}
            className="px-6 py-2.5 text-sm font-bold rounded-lg bg-claw-accent text-white hover:bg-claw-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
          >
            {submitting ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Creating...</>
            ) : 'Create Clip'}
          </button>
        </div>
      </div>
    </div>
  );
}
