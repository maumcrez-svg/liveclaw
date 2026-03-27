import React, { useEffect, useState, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useAppStore } from '../store/app-store';
import { useAuthStore } from '../store/auth-store';
import { fetchConnectionInfo, fetchViewerCount } from '../api/client';
import { resolveTemplate } from '../lib/template-engine';
import { ChatPanel } from '../components/ChatPanel';
import logoImg from '../assets/logo-dark.png';
import type { ConnectionInfo } from '../api/types';

export function SimpleStudioScreen() {
  const transition = useAppStore((s) => s.transition);
  const agentId = useAppStore((s) => s.selectedAgentId);
  const agentSlug = useAppStore((s) => s.selectedAgentSlug);

  const [connInfo, setConnInfo] = useState<ConnectionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [goingLive, setGoingLive] = useState(false);
  const [ffmpegPid, setFfmpegPid] = useState<number | null>(null);
  const [runtimePid, setRuntimePid] = useState<number | null>(null);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [viewerCount, setViewerCount] = useState(0);
  const [showChat, setShowChat] = useState(false);
  const [streamId, setStreamId] = useState<string | null>(null);
  const previewTimerRef = useRef<ReturnType<typeof setInterval>>();
  const viewerTimerRef = useRef<ReturnType<typeof setInterval>>();

  // Load connection info on mount
  useEffect(() => {
    if (!agentId) return;
    (async () => {
      try {
        const info = await fetchConnectionInfo(agentId);
        setConnInfo(info);
        setLoading(false);
      } catch (err: any) {
        setError(err.message || 'Failed to load agent info');
        setLoading(false);
      }
    })();
  }, [agentId]);

  // Preview polling via FFmpeg screenshot
  useEffect(() => {
    if (loading || isLive) return; // Don't poll during live (FFmpeg is busy)

    const capture = async () => {
      try {
        const ffmpeg = await invoke<{ installed: boolean; path: string | null }>('detect_ffmpeg');
        if (!ffmpeg.installed || !ffmpeg.path) return;
        const screenshot = await invoke<string>('ffmpeg_screenshot', { ffmpegPath: ffmpeg.path });
        setPreviewSrc(screenshot);
      } catch {
        // FFmpeg not available or screenshot failed
      }
    };

    capture();
    previewTimerRef.current = setInterval(capture, 2000);
    return () => clearInterval(previewTimerRef.current);
  }, [loading, isLive]);

  // Viewer count polling when live
  useEffect(() => {
    if (!isLive || !agentId) return;
    const poll = async () => {
      const count = await fetchViewerCount(agentId);
      setViewerCount(count);
    };
    poll();
    viewerTimerRef.current = setInterval(poll, 10000);
    return () => clearInterval(viewerTimerRef.current);
  }, [isLive, agentId]);

  const handleGoLive = async () => {
    if (!connInfo || !agentId) return;
    setGoingLive(true);
    setError(null);

    try {
      // 1. Detect FFmpeg
      const ffmpeg = await invoke<{ installed: boolean; path: string | null }>('detect_ffmpeg');
      if (!ffmpeg.installed || !ffmpeg.path) {
        setError('FFmpeg not found. Install it from ffmpeg.org or your package manager.');
        setGoingLive(false);
        return;
      }

      // 2. Resolve template and capture mode
      const template = resolveTemplate(connInfo.streamingMode === 'external' ? 'chat' : 'chat');
      // For now, capture desktop
      const captureMode = template.captureMode;

      // 3. Start FFmpeg stream
      const pid = await invoke<number>('start_ffmpeg_stream', {
        ffmpegPath: ffmpeg.path,
        captureMode,
        rtmpUrl: connInfo.connection.rtmpUrl,
        streamKey: connInfo.connection.streamKey,
        resolution: `${connInfo.recommendedSettings.resolution}`,
        fps: connInfo.recommendedSettings.fps,
      });
      setFfmpegPid(pid);

      // 4. Start agent runtime (if API key available)
      try {
        const rPid = await invoke<number>('start_agent_runtime', {
          config: {
            api_base_url: connInfo.connection.rtmpUrl.replace(/rtmp:\/\/([^:]+).*/, 'https://$1'),
            agent_id: agentId,
            agent_slug: agentSlug || '',
            agent_api_key: '', // Would need API key from config
            llm_api_key: '', // Would need from config
            voice_disabled: true,
          },
        });
        setRuntimePid(rPid);
      } catch {
        // Runtime is optional — stream still works without it
        console.warn('[SimpleStudio] Runtime not started — agent won\'t respond to chat');
      }

      setIsLive(true);
      setGoingLive(false);
    } catch (err: any) {
      setError(err.message || 'Failed to go live');
      setGoingLive(false);
    }
  };

  const handleStop = async () => {
    try {
      if (ffmpegPid) {
        await invoke('stop_ffmpeg_stream', { pid: ffmpegPid });
        setFfmpegPid(null);
      }
      if (runtimePid) {
        await invoke('stop_agent_runtime', { pid: runtimePid });
        setRuntimePid(null);
      }
    } catch {
      // Process might already be dead
    }
    setIsLive(false);
    setViewerCount(0);
  };

  const handleBack = () => {
    handleStop();
    transition('agent_home');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-studio-border border-t-studio-accent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-studio-border bg-studio-card">
          <div className="flex items-center gap-3">
            <img src={logoImg} alt="LiveClaw" className="h-5 w-auto" draggable={false} />
            <div className="w-px h-6 bg-studio-border" />
            {isLive && (
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-studio-live opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-studio-live" />
                </span>
                <span className="text-studio-live font-bold text-sm">LIVE</span>
              </div>
            )}
            <span className="text-sm font-medium text-studio-text">{connInfo?.agentName || agentSlug}</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowChat(!showChat)}
              className={`text-xs border rounded-lg px-3 py-1.5 transition-colors ${
                showChat ? 'border-studio-accent text-studio-accent bg-studio-accent/10' : 'border-studio-border text-studio-muted hover:text-studio-text'
              }`}
            >
              Chat
            </button>
            <button onClick={handleBack} className="text-xs text-studio-muted hover:text-studio-text border border-studio-border rounded-lg px-3 py-1.5">
              Back
            </button>
          </div>
        </div>

        {/* Preview */}
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="w-full max-w-2xl">
            {/* Preview image */}
            <div className="rounded-xl overflow-hidden border border-studio-border bg-black aspect-video relative mb-4">
              {previewSrc ? (
                <img src={previewSrc} alt="Preview" className="w-full h-full object-contain" draggable={false} />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <p className="text-white/50 text-sm">Desktop preview</p>
                    <p className="text-white/30 text-xs mt-1">This is what viewers will see</p>
                  </div>
                </div>
              )}
              {isLive && (
                <div className="absolute top-3 left-3 flex items-center gap-2 bg-studio-live/90 text-white text-xs font-bold px-3 py-1 rounded-full">
                  <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                  LIVE
                </div>
              )}
            </div>

            {/* Stats when live */}
            {isLive && (
              <div className="flex items-center justify-center gap-6 text-xs text-studio-muted mb-4">
                <span>{viewerCount} viewers</span>
                <span>liveclaw.tv/{agentSlug}</span>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="p-3 rounded-lg bg-studio-live/10 border border-studio-live/20 mb-4">
                <p className="text-sm text-studio-live">{error}</p>
              </div>
            )}

            {/* Action button */}
            {!isLive ? (
              <button
                onClick={handleGoLive}
                disabled={goingLive}
                className="w-full py-4 rounded-xl font-bold text-lg bg-studio-accent hover:bg-studio-accent-hover text-white transition-all shadow-lg shadow-studio-accent/25 disabled:opacity-50"
              >
                {goingLive ? 'Starting stream...' : 'Go Live'}
              </button>
            ) : (
              <button
                onClick={handleStop}
                className="w-full py-4 rounded-xl font-bold text-lg bg-studio-live hover:bg-red-700 text-white transition-all shadow-lg shadow-studio-live/25"
              >
                Stop Stream
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Chat sidebar */}
      {showChat && (
        <div className="w-72 shrink-0">
          <ChatPanel streamId={streamId} agentSlug={agentSlug} />
        </div>
      )}
    </div>
  );
}
