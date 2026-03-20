'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
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
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  const getFallbackSrc = useCallback(() => {
    if (HLS_URL === HLS_FALLBACK_URL) return null;
    const hlsPath = src.replace(HLS_URL, '').replace(/^\//, '');
    return `${HLS_FALLBACK_URL}/${hlsPath}`;
  }, [src]);

  const tryPlay = useCallback((video: HTMLVideoElement) => {
    video.play().catch((err) => {
      console.warn('[StreamPlayer] Autoplay blocked:', err.name);
      setPlaybackError('click');
    });
  }, []);

  const handleClickToPlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    setPlaybackError(null);
    video.muted = true;
    video.play().catch(() => {
      setPlaybackError('failed');
    });
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    retriesRef.current = 0;
    usingFallbackRef.current = false;
    setPlaybackError(null);

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
        console.info('[StreamPlayer] Manifest loaded');
        retriesRef.current = 0;
        tryPlay(video!);
      });

      hls.on(Hls.Events.FRAG_LOADED, () => {
        if (retriesRef.current === 0) {
          console.info('[StreamPlayer] First segment loaded');
          retriesRef.current = -1; // only log once
        }
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal) return;

        console.warn('[StreamPlayer] Fatal error:', data.type, data.details);

        if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          hls.recoverMediaError();
          return;
        }

        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          retriesRef.current = Math.max(retriesRef.current, 0);
          retriesRef.current++;

          if (!usingFallbackRef.current && retriesRef.current >= 2) {
            const fallback = getFallbackSrc();
            if (fallback) {
              console.info('[StreamPlayer] CDN unreachable, falling back to direct HLS');
              usingFallbackRef.current = true;
              retriesRef.current = 0;
              createHls(fallback);
              return;
            }
          }

          if (retriesRef.current < 6) {
            setTimeout(() => hls.startLoad(), 2000);
          } else {
            console.warn('[StreamPlayer] Max retries reached, giving up');
            setPlaybackError('network');
            hls.destroy();
          }
          return;
        }

        setPlaybackError('fatal');
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
      const onLoaded = () => {
        console.info('[StreamPlayer] Safari native HLS loaded');
        tryPlay(video);
      };
      video.addEventListener('loadedmetadata', onLoaded);
      return () => {
        video.removeEventListener('loadedmetadata', onLoaded);
      };
    }
  }, [src, getFallbackSrc, tryPlay]);

  return (
    <div className="relative w-full h-full">
      <video
        ref={videoRef}
        className="w-full h-full object-contain bg-black"
        controls
        autoPlay
        playsInline
        muted
      />
      {playbackError && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-black/70 cursor-pointer z-10"
          onClick={handleClickToPlay}
        >
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-white/10 flex items-center justify-center">
              <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            </div>
            <p className="text-white text-sm font-medium">
              {playbackError === 'click'
                ? 'Click to play'
                : playbackError === 'network'
                  ? 'Stream unavailable — click to retry'
                  : 'Playback failed — click to retry'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
