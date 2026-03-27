// ── Studio screen ───────────────────────────────────────────────────
//
// Main workspace. Auto-configures OBS on entry (configuring state).
// Shows source list, config checklist, and Go Live button.

import React, { useEffect, useState, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useAppStore } from '../store/app-store';
import { useOBSStore } from '../store/obs-store';
import { useAuthStore } from '../store/auth-store';
import { getOBS } from '../obs/connection';
import { configureStream, applyVideoSettings, startStream, startRecord, stopRecord } from '../obs/stream';
import { ensureScene, listSources, addSource } from '../obs/scene';
import { resolveInputKind } from '../obs/sources';
import { fetchConnectionInfo, fetchActiveStreamId } from '../api/client';
import { SourceList } from '../components/SourceList';
import { AddSourceModal } from '../components/AddSourceModal';
import { ScenePreview } from '../components/ScenePreview';
import { SourceToolbar } from '../components/SourceToolbar';
import { SourceEditor } from '../components/SourceEditor';
import { ChatPanel } from '../components/ChatPanel';
import { SCENE_TEMPLATES, applySceneTemplate } from '../obs/templates';
import type { ConnectionInfo } from '../api/types';
import logoImg from '../assets/logo-dark.png';

interface ConfigStep {
  id: string;
  label: string;
  done: boolean;
}

export function StudioScreen() {
  const appState = useAppStore((s) => s.state);
  const transition = useAppStore((s) => s.transition);
  const agentId = useAppStore((s) => s.selectedAgentId);
  const agentSlug = useAppStore((s) => s.selectedAgentSlug);
  const setSources = useOBSStore((s) => s.setSources);

  const [connInfo, setConnInfo] = useState<ConnectionInfo | null>(null);
  const [steps, setSteps] = useState<ConfigStep[]>([
    { id: 'stream', label: 'Stream destination', done: false },
    { id: 'video', label: 'Video quality', done: false },
    { id: 'scene', label: 'Scene ready', done: false },
  ]);
  const [configError, setConfigError] = useState<string | null>(null);
  const [goingLive, setGoingLive] = useState(false);
  const [streamTitle, setStreamTitle] = useState('');
  const [addSourceOpen, setAddSourceOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<{ name: string; id: number; kind: string } | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [applyingTemplate, setApplyingTemplate] = useState(false);
  const [recording, setRecording] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [streamId, setStreamId] = useState<string | null>(null);
  const configuredRef = useRef(false);

  // Auto-configure on mount
  useEffect(() => {
    if (appState === 'configuring' && agentId && !configuredRef.current) {
      configuredRef.current = true;
      runConfiguration();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appState, agentId]);

  const markStep = (id: string) => {
    setSteps((prev) =>
      prev.map((s) => (s.id === id ? { ...s, done: true } : s)),
    );
  };

  const runConfiguration = async () => {
    if (!agentId) return;
    setConfigError(null);

    try {
      // 1. Fetch connection info
      const info = await fetchConnectionInfo(agentId);
      setConnInfo(info);

      const obs = getOBS();

      // 2. Configure stream server + key
      await configureStream(obs, info.connection.rtmpUrl, info.connection.streamKey);
      markStep('stream');

      // 3. Apply video settings
      await applyVideoSettings(obs, {
        resolution: info.recommendedSettings.resolution,
        fps: info.recommendedSettings.fps,
      });
      markStep('video');

      // 4. Ensure LiveClaw scene exists
      await ensureScene(obs);
      markStep('scene');

      // 5. Load sources — auto-add Display Capture if scene is empty
      let items = await listSources(obs);
      if (items.length === 0) {
        const supportedKinds = useOBSStore.getState().supportedInputKinds;
        const displayKind = resolveInputKind('display', supportedKinds);
        if (displayKind) {
          try {
            await addSource(obs, { inputName: 'Display Capture', inputKind: displayKind, inputSettings: {} });
            items = await listSources(obs);
          } catch {
            console.warn('[Setup] Display capture add failed even with detected kind:', displayKind);
          }
        } else {
          console.warn('[Setup] No display capture source available on this system.');
        }
      }
      setSources(items);

      // Check if there's already an active stream (e.g. external mode)
      const sid = await fetchActiveStreamId(agentId);
      if (sid) setStreamId(sid);

      // All done
      transition('ready');
    } catch (err: any) {
      setConfigError(err.message || 'Setup hit a snag. Check OBS is running and try again.');
      // Stay on configuring so the user can see what went wrong
    }
  };

  const handleGoLive = async () => {
    setGoingLive(true);
    transition('going_live');
    try {
      const obs = getOBS();
      await startStream(obs);
      transition('live');
    } catch (err: any) {
      transition('ready', err.message || 'Failed to start stream');
      setGoingLive(false);
    }
  };

  const handleChangeAgent = () => {
    configuredRef.current = false;
    transition('picking_agent');
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
      // Record toggle failed
    }
  };

  const handleApplyTemplate = async (templateId: string) => {
    const template = SCENE_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;
    setApplyingTemplate(true);
    try {
      const obs = getOBS();
      await applySceneTemplate(obs, template);
      const items = await listSources(obs);
      setSources(items);
      setShowTemplates(false);
    } catch (err: any) {
      setConfigError(err.message || "Couldn't apply that layout. Try another one.");
    } finally {
      setApplyingTemplate(false);
    }
  };

  const sources = useOBSStore((s) => s.sources);
  const allReady = steps.every((s) => s.done);
  const isReady = appState === 'ready';

  return (
    <div className="flex h-full">
      {/* Main workspace */}
      <div className="flex-1 flex flex-col min-w-0">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-studio-border bg-studio-card">
        <div className="flex items-center gap-3 min-w-0">
          <img src={logoImg} alt="LiveClaw" className="h-5 w-auto shrink-0" draggable={false} />
          <div className="w-px h-6 bg-studio-border shrink-0" />
          <div className="w-10 h-10 rounded-xl bg-studio-bg border border-studio-border overflow-hidden shrink-0">
            <img
              src={
                connInfo?.agentSlug
                  ? `https://api.dicebear.com/7.x/bottts/svg?seed=${connInfo.agentSlug}`
                  : `https://api.dicebear.com/7.x/bottts/svg?seed=${agentSlug}`
              }
              alt="Agent"
              className="w-full h-full"
            />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-studio-text truncate">
              {connInfo?.agentName ?? agentSlug ?? 'Agent'}
            </p>
            <p className="text-xs text-studio-muted">
              {agentSlug ? `liveclaw.tv/${agentSlug}` : ''}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              const { accessToken, refreshToken, user } = useAuthStore.getState();
              const authPayload = accessToken ? encodeURIComponent(JSON.stringify({ token: accessToken, refresh_token: refreshToken, ...user })) : '';
              const url = `https://liveclaw.tv/dashboard/${agentSlug}${authPayload ? `#studio_auth=${authPayload}` : ''}`;
              invoke('open_dashboard', {
                url,
                title: `Dashboard — ${connInfo?.agentName ?? agentSlug}`,
              }).catch(() => {
                window.open(url, '_blank');
              });
            }}
            className="text-xs text-studio-muted hover:text-studio-text border border-studio-border rounded-lg px-3 py-1.5 transition-colors hover:border-studio-accent/50"
          >
            Dashboard
          </button>
          <button
            onClick={handleChangeAgent}
            className="text-xs text-studio-muted hover:text-studio-text border border-studio-border rounded-lg px-3 py-1.5 transition-colors hover:border-studio-accent/50"
          >
            Switch agent
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

      {/* Preview + Sources */}
      <div className="flex-1 overflow-y-auto px-5 py-4 pb-48">
        {/* Scene preview */}
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
          {isReady && (
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
          )}
        </div>
        {/* Scene template picker */}
        {(showTemplates || sources.length === 0) && isReady && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-studio-text">Quick layouts</h2>
              {sources.length > 0 && (
                <button onClick={() => setShowTemplates(false)} className="text-xs text-studio-muted hover:text-studio-accent">&times; Dismiss</button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {SCENE_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => handleApplyTemplate(t.id)}
                  disabled={applyingTemplate}
                  className="text-left p-3 rounded-lg border border-studio-border hover:border-studio-accent bg-studio-bg transition-all hover:bg-studio-card group disabled:opacity-50"
                >
                  {t.thumbnail ? (
                    <img src={t.thumbnail} alt={t.name} className="w-10 h-10 rounded object-cover mb-1.5 group-hover:scale-105 transition-transform" draggable={false} />
                  ) : (
                    <span className="text-xl block mb-1.5">{t.icon}</span>
                  )}
                  <p className="text-xs font-medium text-studio-text">{t.name}</p>
                  <p className="text-[10px] text-studio-muted mt-0.5 line-clamp-2">{t.description}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mb-3 mt-1">
          <h2 className="text-xs font-medium text-studio-muted uppercase tracking-wider">Sources</h2>
          <div className="flex gap-2">
            {sources.length > 0 && !showTemplates && (
              <button
                onClick={() => setShowTemplates(true)}
                className="text-[10px] px-2.5 py-1 rounded bg-studio-bg border border-studio-border text-studio-muted hover:text-studio-text hover:border-studio-accent transition-colors"
              >
                Layouts
              </button>
            )}
            <button
              onClick={() => setAddSourceOpen(true)}
              className="text-[10px] px-2.5 py-1 rounded bg-studio-bg border border-studio-border text-studio-muted hover:text-studio-text hover:border-studio-accent transition-colors"
            >
              + Add source
            </button>
          </div>
        </div>
        <SourceList
          onSourceSelect={(name, id) => {
            const src = sources.find((s) => s.sceneItemId === id);
            setEditingSource(src ? { name, id, kind: src.inputKind } : null);
          }}
          selectedSource={editingSource?.name ?? null}
        />
      </div>

      {/* Bottom panel: checklist + go live */}
      <div className="border-t border-studio-border px-5 py-4 bg-studio-card pb-10">
        {/* Config checklist */}
        <div className="flex items-center gap-4 mb-3">
          {steps.map((step) => (
            <div key={step.id} className="flex items-center gap-1.5 text-xs">
              <span
                className={`w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-medium ${
                  step.done
                    ? 'bg-studio-success/20 text-studio-success border border-studio-success/30'
                    : 'bg-studio-border/50 text-studio-muted border border-studio-border'
                }`}
              >
                {step.done ? '\u2713' : '\u00B7'}
              </span>
              <span
                className={
                  step.done ? 'text-studio-text' : 'text-studio-muted'
                }
              >
                {step.label}
              </span>
            </div>
          ))}
        </div>

        {/* Error */}
        {configError && (
          <div className="mb-3 text-sm text-studio-live">
            {configError}
            <button
              onClick={() => { configuredRef.current = false; runConfiguration(); }}
              className="ml-2 text-studio-accent hover:text-studio-accent-hover"
            >
              Try again
            </button>
          </div>
        )}

        {/* Stream title */}
        {isReady && (
          <div className="mb-3">
            <input
              type="text"
              value={streamTitle}
              onChange={(e) => setStreamTitle(e.target.value)}
              placeholder="Give this stream a title (optional)"
              className="w-full bg-studio-bg border border-studio-border rounded-lg px-3 py-2 text-sm text-studio-text placeholder:text-studio-muted/50 focus:outline-none focus:border-studio-accent"
            />
          </div>
        )}

        {/* Go Live + Record buttons */}
        <div className="flex gap-2">
          <button
            onClick={handleRecord}
            className={`px-4 py-3.5 rounded-xl font-semibold text-xs transition-all border ${
              recording
                ? 'border-studio-live bg-studio-live/10 text-studio-live'
                : 'border-studio-border text-studio-muted hover:border-studio-accent hover:text-studio-text'
            }`}
          >
            {recording ? '\u23F9 Stop Rec' : '\u23FA Record'}
          </button>
          <button
            onClick={handleGoLive}
            disabled={!isReady || goingLive}
            className={`flex-1 py-3.5 rounded-xl font-semibold text-sm transition-all ${
              isReady
                ? 'bg-studio-accent hover:bg-studio-accent-hover text-white shadow-lg shadow-studio-accent/25 hover:shadow-xl hover:shadow-studio-accent/30'
                : 'bg-studio-border text-studio-muted cursor-not-allowed'
            }`}
          >
            {goingLive
              ? 'Going live...'
              : appState === 'configuring'
              ? 'Setting things up...'
              : 'Go live'}
          </button>
        </div>
      </div>

      {/* Add source modal */}
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
