'use client';

import { useEffect, useRef, useCallback } from 'react';
import Hls from 'hls.js';

const HLS_URL = process.env.NEXT_PUBLIC_HLS_URL || '/hls';
const HLS_FALLBACK_URL = '/hls';

interface StreamPlayerProps {
  src: string;
}

export function StreamPlayer({ src }: StreamPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const retriesRef = useRef(0);
  const usingFallbackRef = useRef(false);

  const getFallbackSrc = useCallback(() => {
    // If primary URL is already the fallback, no point switching
    if (HLS_URL === HLS_FALLBACK_URL) return null;
    // Replace the CDN base with the direct MediaMTX path
    const hlsPath = src.replace(HLS_URL, '').replace(/^\//, '');
    return `${HLS_FALLBACK_URL}/${hlsPath}`;
  }, [src]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    retriesRef.current = 0;
    usingFallbackRef.current = false;

    function createHls(url: string) {
      hlsRef.current?.destroy();

      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        liveSyncDuration: 2,
        liveMaxLatencyDuration: 4,
        liveDurationInfinity: true,
        highBufferWatchdogPeriod: 1,
        backBufferLength: 5,
        maxBufferLength: 4,
        maxMaxBufferLength: 8,
        manifestLoadingMaxRetry: 2,
        manifestLoadingRetryDelay: 1000,
        levelLoadingMaxRetry: 2,
      });

      hls.loadSource(url);
      hls.attachMedia(video!);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video!.play().catch(() => {});
        retriesRef.current = 0;
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal) return;

        if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          hls.recoverMediaError();
          return;
        }

        // Network error — try fallback if available
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          retriesRef.current++;

          if (!usingFallbackRef.current && retriesRef.current >= 2) {
            const fallback = getFallbackSrc();
            if (fallback) {
              console.log('[StreamPlayer] CDN unreachable, falling back to direct HLS');
              usingFallbackRef.current = true;
              retriesRef.current = 0;
              createHls(fallback);
              return;
            }
          }

          // Already on fallback or no fallback available — keep retrying
          if (retriesRef.current < 6) {
            setTimeout(() => hls.startLoad(), 2000);
          } else {
            hls.destroy();
          }
          return;
        }

        hls.destroy();
      });

      hlsRef.current = hls;
    }

    if (Hls.isSupported()) {
      createHls(src);
      return () => hlsRef.current?.destroy();
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari native HLS
      video.src = src;
      video.addEventListener('loadedmetadata', () => {
        video.play().catch(() => {});
      });
    }
  }, [src, getFallbackSrc]);

  return (
    <video
      ref={videoRef}
      className="w-full h-full object-contain bg-black"
      controls
      playsInline
      muted
    />
  );
}
