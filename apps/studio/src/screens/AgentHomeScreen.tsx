// ── Agent Home screen ────────────────────────────────────────────────
//
// Landing page after selecting/creating an agent. Shows agent info
// with clear actions: Start Streaming, Edit, Dashboard.

import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useAppStore } from '../store/app-store';
import { fetchAgentBySlug } from '../api/client';
import { useAuthStore } from '../store/auth-store';
import type { Agent } from '../api/types';
import logoImg from '../assets/logo-dark.png';

export function AgentHomeScreen() {
  const transition = useAppStore((s) => s.transition);
  const agentSlug = useAppStore((s) => s.selectedAgentSlug);
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!agentSlug) return;
    (async () => {
      try {
        const data = await fetchAgentBySlug(agentSlug);
        setAgent(data);
      } catch {
        // fallback — continue with slug only
      } finally {
        setLoading(false);
      }
    })();
  }, [agentSlug]);

  const handleStartStreaming = () => {
    transition('simple_studio');
  };

  const handleChangeAgent = () => {
    transition('picking_agent');
  };

  const handleDashboard = () => {
    const { accessToken, refreshToken, user } = useAuthStore.getState();
    const authPayload = accessToken ? encodeURIComponent(JSON.stringify({ token: accessToken, refresh_token: refreshToken, ...user })) : '';
    const url = `https://liveclaw.tv/dashboard/${agentSlug}${authPayload ? `#studio_auth=${authPayload}` : ''}`;
    invoke('open_dashboard', {
      url,
      title: `Dashboard — ${agent?.name ?? agentSlug}`,
    }).catch(() => {
      window.open(url, '_blank');
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-studio-border border-t-studio-accent rounded-full animate-spin" />
      </div>
    );
  }

  const avatarUrl = agent?.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${agentSlug}`;
  const status = agent?.status || 'offline';

  return (
    <div className="flex flex-col items-center justify-center h-full px-8">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <img src={logoImg} alt="LiveClaw" className="h-8 w-auto" draggable={false} />
        </div>
        {/* Agent card */}
        <div className="p-6 rounded-2xl border border-studio-border bg-studio-card shadow-sm text-center mb-6">
          {/* Avatar */}
          <div className="w-20 h-20 mx-auto rounded-2xl border-2 border-studio-border overflow-hidden mb-4 shadow-lg">
            <img
              src={avatarUrl}
              alt={agent?.name || agentSlug || ''}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Name & slug */}
          <h1 className="text-xl font-bold text-studio-text">
            {agent?.name || agentSlug}
          </h1>
          <p className="text-sm text-studio-muted mt-1">
            liveclaw.tv/{agentSlug}
          </p>

          {/* Status badge */}
          <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-studio-bg border border-studio-border">
            <span
              className={`w-2 h-2 rounded-full ${
                status === 'live'
                  ? 'bg-studio-live animate-pulse'
                  : status === 'online'
                  ? 'bg-studio-success'
                  : 'bg-studio-muted'
              }`}
            />
            <span className="text-xs text-studio-muted capitalize">{status}</span>
          </div>

          {/* Description */}
          {agent?.description && (
            <p className="text-xs text-studio-muted mt-4 leading-relaxed max-w-xs mx-auto">
              {agent.description}
            </p>
          )}

          {/* Quick stats */}
          {agent && (
            <div className="flex justify-center gap-6 mt-4 pt-4 border-t border-studio-border">
              <div className="text-center">
                <p className="text-sm font-semibold text-studio-text">{agent.followerCount}</p>
                <p className="text-[10px] text-studio-muted">followers</p>
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-studio-text">{agent.subscriberCount}</p>
                <p className="text-[10px] text-studio-muted">subscribers</p>
              </div>
            </div>
          )}
        </div>

        {/* Primary action */}
        <button
          onClick={handleStartStreaming}
          className="w-full py-3.5 rounded-xl font-semibold text-sm bg-studio-accent hover:bg-studio-accent-hover text-white transition-all shadow-lg shadow-studio-accent/25 hover:shadow-xl hover:shadow-studio-accent/30 mb-3"
        >
          Start streaming
        </button>

        {/* Secondary actions */}
        <div className="flex gap-2">
          <button
            onClick={handleDashboard}
            className="flex-1 py-2.5 rounded-lg border border-studio-border text-sm text-studio-muted hover:text-studio-text hover:border-studio-accent/50 transition-colors"
          >
            Dashboard
          </button>
          <button
            onClick={handleChangeAgent}
            className="flex-1 py-2.5 rounded-lg border border-studio-border text-sm text-studio-muted hover:text-studio-text hover:border-studio-accent/50 transition-colors"
          >
            Switch agent
          </button>
        </div>

        {/* Advanced mode */}
        <button
          onClick={() => transition('configuring')}
          className="w-full mt-2 py-2 text-[10px] text-studio-muted hover:text-studio-accent transition-colors"
        >
          Advanced mode (OBS)
        </button>
      </div>
    </div>
  );
}
