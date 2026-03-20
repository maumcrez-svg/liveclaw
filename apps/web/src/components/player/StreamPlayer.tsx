'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import Hls from 'hls.js';

const HLS_URL = process.env.NEXT_PUBLIC_HLS_URL || '/hls';
const HLS_FALLBACK_URL = '/hls';

interface StreamPlayerProps {
  src: string;
}

function isMobile(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent,
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getHlsConfig(mobile: boolean): Record<string, any> {
  if (mobile) {
    return {
      enableWorker: true,
      lowLatencyMode: false,
      liveSyncDurationCount: 4,
      liveMaxLatencyDurationCount: 8,
      liveDurationInfinity: true,
      highBufferWatchdogPeriod: 2,
      backBufferLength: 10,
      maxBufferLength: 15,
      maxMaxBufferLength: 30,
      maxBufferHole: 0.5,
      manifestLoadingMaxRetry: 6,
      manifestLoadingRetryDelay: 1000,
      manifestLoadingMaxRetryTimeout: 8000,
      levelLoadingMaxRetry: 6,
      levelLoadingRetryDelay: 1000,
      fragLoadingMaxRetry: 6,
      fragLoadingRetryDelay: 1000,
    };
  }

  return {
    enableWorker: true,
    lowLatencyMode: true,
    liveSyncDurationCount: 3,
    liveMaxLatencyDurationCount: 6,
    liveDurationInfinity: true,
    highBufferWatchdogPeriod: 2,
    backBufferLength: 10,
    maxBufferLength: 10,
    maxMaxBufferLength: 20,
    maxBufferHole: 0.5,
    manifestLoadingMaxRetry: 6,
    manifestLoadingRetryDelay: 1000,
    manifestLoadingMaxRetryTimeout: 8000,
    levelLoadingMaxRetry: 6,
    levelLoadingRetryDelay: 1000,
    fragLoadingMaxRetry: 6,
    fragLoadingRetryDelay: 1000,
  };
}

export function StreamPlayer({ src }: StreamPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const retriesRef = useRef(0);
  const usingFallbackRef = useRef(false);
  const stallCountRef = useRef(0);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const mobile = useRef(false);

  useEffect(() => {
    mobile.current = isMobile();
  }, []);

  const getFallbackSrc = useCallback(() => {
    if (HLS_URL === HLS_FALLBACK_URL) return null;
    const hlsPath = src.replace(HLS_URL, '').replace(/^\//, '');
    return `${HLS_FALLBACK_URL}/${hlsPath}`;
  }, [src]);

  const tryPlay = useCallback((video: HTMLVideoElement) => {
    video.play().then(() => {
      // Firefox can resolve play() without error but keep video paused
      setTimeout(() => {
        if (video.paused && !video.ended) {
          console.warn('[StreamPlayer] play() resolved but video still paused (Firefox autoplay policy)');
          setPlaybackError('click');
        }
      }, 500);
    }).catch((err) => {
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

    console.info('[StreamPlayer] Init | browser:', navigator.userAgent.slice(0, 80));

    retriesRef.current = 0;
    usingFallbackRef.current = false;
    stallCountRef.current = 0;
    setPlaybackError(null);

    const isMobileDevice = mobile.current;

    // ─── Video element event listeners for stall detection ───
    let stallRecoveryTimer: ReturnType<typeof setTimeout> | null = null;

    const onWaiting = () => {
      stallCountRef.current++;
      const bufLen = getBufferLength(video);
      console.warn(
        `[StreamPlayer] STALL #${stallCountRef.current} | buffer: ${bufLen.toFixed(2)}s | currentTime: ${video.currentTime.toFixed(2)}`,
      );

      // If stalled for more than 3s, try to nudge playback
      stallRecoveryTimer = setTimeout(() => {
        if (video.paused || video.readyState < 3) {
          console.info('[StreamPlayer] Stall recovery: nudging playback');
          const hls = hlsRef.current;
          if (hls) {
            // Drop to live edge
            const edge = hls.liveSyncPosition;
            if (edge && edge > video.currentTime + 1) {
              console.info(
                `[StreamPlayer] Jumping to live edge: ${video.currentTime.toFixed(2)} → ${edge.toFixed(2)}`,
              );
              video.currentTime = edge;
            }
          }
          video.play().catch(() => {});
        }
      }, 3000);
    };

    const onPlaying = () => {
      if (stallCountRef.current > 0) {
        console.info(
          `[StreamPlayer] Playback resumed after ${stallCountRef.current} stall(s) | buffer: ${getBufferLength(video).toFixed(2)}s`,
        );
      }
      if (stallRecoveryTimer) {
        clearTimeout(stallRecoveryTimer);
        stallRecoveryTimer = null;
      }
    };

    const onStalled = () => {
      console.warn(
        `[StreamPlayer] Browser reports stalled | buffer: ${getBufferLength(video).toFixed(2)}s`,
      );
    };

    video.addEventListener('waiting', onWaiting);
    video.addEventListener('playing', onPlaying);
    video.addEventListener('stalled', onStalled);

    function createHls(url: string) {
      hlsRef.current?.destroy();

      const config = getHlsConfig(isMobileDevice);
      const hls = new Hls(config);

      console.info(
        `[StreamPlayer] Creating HLS instance | mobile: ${isMobileDevice} | lowLatency: ${config.lowLatencyMode ?? false} | src: ${url}`,
      );

      hls.loadSource(url);
      hls.attachMedia(video!);

      hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
        console.info(
          `[StreamPlayer] Manifest loaded | levels: ${data.levels.length} | audioTracks: ${data.audioTracks.length}`,
        );
        retriesRef.current = 0;
        stallCountRef.current = 0;
        tryPlay(video!);
      });

      let firstFragLogged = false;
      hls.on(Hls.Events.FRAG_LOADED, (_event, data) => {
        if (!firstFragLogged) {
          firstFragLogged = true;
          const stats = data.frag.stats;
          console.info(
            `[StreamPlayer] First segment loaded | duration: ${data.frag.duration.toFixed(2)}s | size: ${(stats.total / 1024).toFixed(1)}KB | load time: ${(stats.loading.end - stats.loading.start).toFixed(0)}ms`,
          );
        }
      });

      // ─── Non-fatal error handling (buffer stalls, etc.) ───
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal) {
          // Log non-fatal errors that indicate buffer/network issues
          if (
            data.details === Hls.ErrorDetails.BUFFER_STALLED_ERROR ||
            data.details === Hls.ErrorDetails.BUFFER_NUDGE_ON_STALL
          ) {
            console.warn(
              `[StreamPlayer] Buffer issue (non-fatal): ${data.details} | buffer: ${getBufferLength(video!).toFixed(2)}s`,
            );
          }
          return;
        }

        console.error(
          `[StreamPlayer] Fatal error: ${data.type} / ${data.details}`,
        );

        if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          console.info('[StreamPlayer] Attempting media error recovery');
          hls.recoverMediaError();
          return;
        }

        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          retriesRef.current = Math.max(retriesRef.current, 0);
          retriesRef.current++;

          console.warn(
            `[StreamPlayer] Network error #${retriesRef.current} | detail: ${data.details}`,
          );

          if (!usingFallbackRef.current && retriesRef.current >= 3) {
            const fallback = getFallbackSrc();
            if (fallback) {
              console.info(
                '[StreamPlayer] CDN unreachable, falling back to direct HLS',
              );
              usingFallbackRef.current = true;
              retriesRef.current = 0;
              createHls(fallback);
              return;
            }
          }

          if (retriesRef.current < 10) {
            const delay = Math.min(1000 * retriesRef.current, 5000);
            console.info(
              `[StreamPlayer] Retrying in ${delay}ms (attempt ${retriesRef.current}/10)`,
            );
            setTimeout(() => hls.startLoad(), delay);
          } else {
            console.error('[StreamPlayer] Max retries reached, giving up');
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
      return () => {
        hlsRef.current?.destroy();
        video.removeEventListener('waiting', onWaiting);
        video.removeEventListener('playing', onPlaying);
        video.removeEventListener('stalled', onStalled);
        if (stallRecoveryTimer) clearTimeout(stallRecoveryTimer);
      };
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
        video.removeEventListener('waiting', onWaiting);
        video.removeEventListener('playing', onPlaying);
        video.removeEventListener('stalled', onStalled);
        if (stallRecoveryTimer) clearTimeout(stallRecoveryTimer);
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
              <svg
                className="w-8 h-8 text-white"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
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

function getBufferLength(video: HTMLVideoElement): number {
  if (video.buffered.length === 0) return 0;
  return video.buffered.end(video.buffered.length - 1) - video.currentTime;
}
