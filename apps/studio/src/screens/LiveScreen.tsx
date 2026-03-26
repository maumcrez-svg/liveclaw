// ── Live screen ─────────────────────────────────────────────────────
//
// Active stream view with stats, duration, sources, and stop button.
// Polls OBS stream status every 2s and agent status every 10s.

import React, { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useAppStore } from '../store/app-store';
import { useOBSStore } from '../store/obs-store';
import { useAuthStore } from '../store/auth-store';
import { getOBS } from '../obs/connection';
import { getStreamStatus, stopStream, startRecord, stopRecord } from '../obs/stream';
import { listSources, addSource } from '../obs/scene';
import { fetchConnectionInfo, fetchViewerCount, fetchActiveStreamId, updateStreamTitle } from '../api/client';
import { SourceList } from '../components/SourceList';
import { AddSourceModal } from '../components/AddSourceModal';
import { ScenePreview } from '../components/ScenePreview';
import { SourceToolbar } from '../components/SourceToolbar';
import { SourceEditor } from '../components/SourceEditor';
import { ChatPanel } from '../components/ChatPanel';
import logoImg from '../assets/logo-dark.png';

export function LiveScreen() {
  const transition = useAppStore((s) => s.transition);
  const agentId = useAppStore((s) => s.selectedAgentId);
  const agentSlug = useAppStore((s) => s.selectedAgentSlug);
  const streamDuration = useOBSStore((s) => s.streamDuration);
  const streamBytes = useOBSStore((s) => s.streamBytes);
  const streamDroppedFrames = useOBSStore((s) => s.streamDroppedFrames);
  const updateStreamStatus = useOBSStore((s) => s.updateStreamStatus);
  const setSources = useOBSStore((s) => s.setSources);
  const resetStream = useOBSStore((s) => s.resetStream);

  const [stopping, setStopping] = useState(false);
  const [addSourceOpen, setAddSourceOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<{ name: string; id: number; kind: string } | null>(null);
  const [recording, setRecording] = useState(false);
  const [watchUrl, setWatchUrl] = useState<string | null>(null);
  const [viewerCount, setViewerCount] = useState(0);
  const [streamTitle, setStreamTitle] = useState('');
  const [streamId, setStreamId] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(true);
  const [titleSaveError, setTitleSaveError] = useState(false);
  const [recordError, setRecordError] = useState(false);
  const streamPollRef = useRef<ReturnType<typeof setInterval>>();
  const agentPollRef = useRef<ReturnType<typeof setInterval>>();
  const viewerPollRef = useRef<ReturnType<typeof setInterval>>();
  const titleDebounceRef = useRef<ReturnType<typeof setTimeout>>();
  const titleFailCount = useRef(0);
  const focusedRef = useRef(true);

  // Pause polling when the app window is hidden / minimised
  useEffect(() => {
    const onFocus = () => { focusedRef.current = true; };
    const onBlur = () => { focusedRef.current = false; };
    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  // Poll OBS stream status every 2s
  useEffect(() => {
    const poll = async () => {
      if (!focusedRef.current) return;
      try {
        const obs = getOBS();
        if (!obs.isConnected()) return;
        const status = await getStreamStatus(obs);
        updateStreamStatus({
          active: status.active,
          duration: status.duration,
          bytes: status.bytes,
          droppedFrames: status.droppedFrames,
        });

        // If OBS reports stream stopped, transition back
        if (!status.active) {
          setViewerCount(0);
          resetStream();
          transition('ready');
        }
      } catch {
        // OBS disconnected
      }
    };

    poll(); // immediate
    streamPollRef.current = setInterval(poll, 2000);
    return () => clearInterval(streamPollRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll agent status every 10s to get watch URL + stream ID
  useEffect(() => {
    if (!agentId) return;

    const poll = async () => {
      if (!focusedRef.current) return;
      try {
        const info = await fetchConnectionInfo(agentId);
        if (info.connection.watchUrl) {
          setWatchUrl(info.connection.watchUrl);
        }
      } catch {
        // ignore
      }

      // Fetch stream ID once (needed for title updates)
      if (!streamId) {
        const sid = await fetchActiveStreamId(agentId);
        if (sid) setStreamId(sid);
      }
    };

    poll(); // immediate
    agentPollRef.current = setInterval(poll, 10000);
    return () => clearInterval(agentPollRef.current);
  }, [agentId, streamId]);

  // Poll viewer count every 10s
  useEffect(() => {
    if (!agentId) return;
    const poll = async () => {
      if (!focusedRef.current) return;
      const count = await fetchViewerCount(agentId);
      setViewerCount(count);
    };
    poll();
    viewerPollRef.current = setInterval(poll, 10000);
    return () => clearInterval(viewerPollRef.current);
  }, [agentId]);

  // Refresh sources on mount
  useEffect(() => {
    (async () => {
      try {
        const obs = getOBS();
        const items = await listSources(obs);
        setSources(items);
      } catch {
        // ignore
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTitleChange = (value: string) => {
    setStreamTitle(value);
    if (titleDebounceRef.current) clearTimeout(titleDebounceRef.current);
    if (!streamId) return;
    titleDebounceRef.current = setTimeout(async () => {
      try {
        await updateStreamTitle(streamId, value);
        titleFailCount.current = 0;
        setTitleSaveError(false);
      } catch {
        titleFailCount.current++;
        if (titleFailCount.current >= 3) {
          setTitleSaveError(true);
        }
      }
    }, 1000);
  };

  const handleStop = async () => {
    setStopping(true);
    transition('stopping');
    try {
      const obs = getOBS();
      await stopStream(obs);
      resetStream();
      transition('ready');
    } catch (err: any) {
      transition('live', err.message || 'Failed to stop stream');
    } finally {
      setStopping(false);
    }
  };

  const handleRecord = async () => {
    try {
      const obs = getOBS();
      if (recording) {
        await stopRecord(obs);
        setRecording(false);
      } else {
        await startRecord(obs);
        setRecording(true);
      }
    } catch {
      setRecordError(true);
      setTimeout(() => setRecordError(false), 3000);
    }
  };

  const sources = useOBSStore((s) => s.sources);
  const bitrateKBs = streamBytes > 0 ? Math.round(streamBytes / Math.max(streamDuration / 1000, 1) / 1024) : 0;

  return (
    <div className="flex h-full">
      {/* Main workspace */}
      <div className="flex-1 flex flex-col min-w-0">
      {/* Live header */}
      <div className="px-5 py-4 border-b border-studio-border bg-studio-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logoImg} alt="LiveClaw" className="h-5 w-auto shrink-0" draggable={false} />
            <div className="w-px h-6 bg-studio-border shrink-0" />
            {/* Pulsing LIVE badge */}
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-studio-live opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-studio-live" />
              </span>
              <span className="text-studio-live font-bold text-lg tracking-wide">
                LIVE
              </span>
            </div>

            {/* Duration */}
            <span className="text-studio-text font-mono text-sm">
              {formatDuration(streamDuration)}
            </span>
          </div>

          {/* Agent */}
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm text-studio-text font-medium">{agentSlug}</p>
              {watchUrl && (
                <a
                  href={watchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-studio-accent hover:text-studio-accent-hover transition-colors"
                >
                  Watch at liveclaw.tv/{agentSlug}
                </a>
              )}
            </div>
            <button
              onClick={() => {
                const { accessToken, refreshToken, user } = useAuthStore.getState();
                const authPayload = accessToken ? encodeURIComponent(JSON.stringify({ token: accessToken, refresh_token: refreshToken, ...user })) : '';
                const url = `https://liveclaw.tv/dashboard/${agentSlug}${authPayload ? `#studio_auth=${authPayload}` : ''}`;
                invoke('open_dashboard', {
                  url,
                  title: `Dashboard — ${agentSlug}`,
                }).catch(() => {
                  window.open(url, '_blank');
                });
              }}
              className="text-xs text-studio-muted hover:text-studio-text border border-studio-border rounded-lg px-3 py-1.5 transition-colors hover:border-studio-accent/50"
            >
              Dashboard
            </button>
            <button
              onClick={() => setShowChat(!showChat)}
              className={`text-xs border rounded-lg px-3 py-1.5 transition-colors ${
                showChat
                  ? 'border-studio-accent text-studio-accent bg-studio-accent/10'
                  : 'border-studio-border text-studio-muted hover:text-studio-text hover:border-studio-accent/50'
              }`}
            >
              Chat
            </button>
          </div>
        </div>

        {/* Editable stream title */}
        <div className="mt-2">
          <input
            type="text"
            value={streamTitle}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="Stream title..."
            className="w-full bg-transparent border-b border-studio-border/50 text-sm text-studio-text placeholder:text-studio-muted/40 focus:outline-none focus:border-studio-accent py-1 px-0"
          />
          {titleSaveError && (
            <p className="text-[10px] text-studio-live mt-0.5">Title couldn't be saved</p>
          )}
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 mt-3 text-xs text-studio-muted bg-studio-bg/50 rounded-lg px-3 py-2">
          <div className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" /></svg>
            <span className="text-studio-text font-medium">{viewerCount}</span>
            {viewerCount === 1 ? 'viewer' : 'viewers'}
          </div>
          <div>
            <span className="text-studio-text font-medium">{bitrateKBs}</span>{' '}
            KB/s
          </div>
          <div>
            <span className="text-studio-text font-medium">
              {streamDroppedFrames}
            </span>{' '}
            dropped
          </div>
        </div>
      </div>

      {/* Live preview + Sources */}
      <div className="flex-1 overflow-y-auto px-5 py-4 pb-32">
        {/* Live preview via OBS Virtual Camera (or screenshot fallback) */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-medium text-studio-muted uppercase tracking-wider">Preview</h2>
          </div>
          <ScenePreview
            onImageDropped={async (path) => {
              try {
                const obs = getOBS();
                await addSource(obs, {
                  inputName: `Image ${Date.now().toString(36).slice(-4)}`,
                  inputKind: 'image_source',
                  inputSettings: { file: path },
                });
                const items = await listSources(obs);
                setSources(items);
              } catch {
                // Image add failed
              }
            }}
            onSourceSelect={(name, id) => {
              const s = sources.find((src) => src.sceneItemId === id);
              setEditingSource(s ? { name, id, kind: s.inputKind } : null);
            }}
            selectedSource={editingSource?.id ?? null}
          />
          <SourceToolbar
            onTextAdded={async (name) => {
              try {
                const obs = getOBS();
                const items = await listSources(obs);
                setSources(items);
                const newItem = items.find((s) => s.sourceName === name);
                if (newItem) {
                  setEditingSource({ name, id: newItem.sceneItemId, kind: newItem.inputKind });
                }
              } catch {
                // Source lookup failed
              }
            }}
            onNeedConfig={() => setAddSourceOpen(true)}
          />
        </div>

        <div className="flex items-center justify-between mb-3 mt-1">
          <h2 className="text-xs font-medium text-studio-muted uppercase tracking-wider">Sources</h2>
          <button
            onClick={() => setAddSourceOpen(true)}
            className="text-[10px] px-2.5 py-1 rounded bg-studio-bg border border-studio-border text-studio-muted hover:text-studio-text hover:border-studio-accent transition-colors"
          >
            + Add source
          </button>
        </div>
        <SourceList
          onSourceSelect={(name, id) => {
            const src = sources.find((s) => s.sceneItemId === id);
            setEditingSource(src ? { name, id, kind: src.inputKind } : null);
          }}
          selectedSource={editingSource?.name ?? null}
        />
      </div>

      {/* Stop + Record buttons */}
      <div className="border-t border-studio-border px-5 py-4 bg-studio-card pb-10">
        <div className="flex gap-2">
          <button
            onClick={handleRecord}
            className={`px-4 py-3.5 rounded-xl font-semibold text-xs transition-all border ${
              recordError
                ? 'border-studio-live text-studio-live'
                : recording
                  ? 'border-studio-live bg-studio-live/10 text-studio-live'
                  : 'border-studio-border text-studio-muted hover:border-studio-accent hover:text-studio-text'
            }`}
          >
            {recording ? '\u23F9 Stop Rec' : '\u23FA Record'}
          </button>
          <button
            onClick={handleStop}
            disabled={stopping}
            className="flex-1 py-3.5 rounded-xl font-semibold text-sm bg-studio-live hover:bg-red-700 text-white transition-all shadow-lg shadow-studio-live/25 hover:shadow-xl hover:shadow-studio-live/30 disabled:opacity-50"
          >
            {stopping ? 'Stopping...' : 'Stop Stream'}
          </button>
        </div>
      </div>

      <AddSourceModal
        open={addSourceOpen}
        onClose={() => setAddSourceOpen(false)}
      />

      {/* Source editor panel */}
      {editingSource && (
        <SourceEditor
          sourceName={editingSource.name}
          sceneItemId={editingSource.id}
          inputKind={editingSource.kind}
          onClose={() => setEditingSource(null)}
        />
      )}
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

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
