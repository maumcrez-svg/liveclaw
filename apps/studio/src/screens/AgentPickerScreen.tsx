// ── Agent picker screen ─────────────────────────────────────────────
//
// Lists user's agents + inline agent creation wizard.

import React, { useEffect, useState } from 'react';
import { useAppStore } from '../store/app-store';
import { useAuthStore } from '../store/auth-store';
import { fetchAgents, fetchConnectionInfo, createAgent, becomeCreator, refreshTokens, ApiError } from '../api/client';
import type { Agent } from '../api/types';
import { CreateWizard } from '../components/wizard/CreateWizard';
import imgCustom from '../assets/template-custom.png';
import logoImg from '../assets/logo-dark.png';

export function AgentPickerScreen() {
  const transition = useAppStore((s) => s.transition);
  const setAgent = useAppStore((s) => s.setAgent);
  const deepLinkAgent = useAppStore((s) => s.deepLinkAgent);
  const setDeepLinkAgent = useAppStore((s) => s.setDeepLinkAgent);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const username = useAuthStore((s) => s.username);

  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAgents();
      setAgents(data);

      if (deepLinkAgent) {
        const match = data.find((a) => a.slug === deepLinkAgent);
        if (match && match.streamingMode === 'external') {
          setDeepLinkAgent(null);
          selectAgent(match);
          return;
        }
        setDeepLinkAgent(null);
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        transition('login_required');
        return;
      }
      setError("Couldn't load your agents. Check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const selectAgent = async (agent: Agent) => {
    if (agent.streamingMode !== 'external') return;
    setSelecting(agent.id);
    setError(null);
    try {
      await fetchConnectionInfo(agent.id);
      setAgent(agent.id, agent.slug);
      transition('agent_home');
    } catch (err: any) {
      setError(err.message || "Couldn't connect to this agent.");
      setSelecting(null);
    }
  };

  const handleWizardComplete = async (data: {
    name: string;
    slug: string;
    description: string;
    agentType: string;
    instructions: string;
    defaultTags: string[];
    apiKey?: string;
    model?: string;
    config: Record<string, unknown>;
  }) => {
    // Ensure user is creator, then refresh token to get updated role
    try {
      await becomeCreator();
      await refreshTokens();
    } catch { /* already creator or refresh failed — try creating anyway */ }

    const agent = await createAgent({
      ...data,
      streamingMode: 'external',
    });

    // Auto-select the newly created agent
    setAgent(agent.id, agent.slug);
    transition('agent_home');
  };

  const handleLogout = async () => {
    await clearAuth();
    transition('login_required');
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-5 border-b border-studio-border bg-studio-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logoImg} alt="LiveClaw" className="h-6 w-auto" draggable={false} />
            <div className="w-px h-6 bg-studio-border" />
            <div>
              <h1 className="text-lg font-bold text-studio-text">
                {showCreate ? 'Create an agent' : 'Your agents'}
              </h1>
              <p className="text-xs text-studio-muted">
                {showCreate ? 'Set up a new AI agent to stream' : `Welcome, ${username}`}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {!showCreate && !loading && (
              <button
                onClick={() => setShowCreate(true)}
                className="text-xs px-4 py-2 bg-studio-accent text-white rounded-lg hover:bg-studio-accent-hover transition-all shadow-sm shadow-studio-accent/20 font-medium"
              >
                + New agent
              </button>
            )}
            {showCreate && (
              <button
                onClick={() => setShowCreate(false)}
                className="text-xs px-3 py-2 text-studio-muted hover:text-studio-text border border-studio-border rounded-lg transition-colors"
              >
                Back to list
              </button>
            )}
            <button
              onClick={handleLogout}
              className="text-xs px-3 py-2 text-studio-muted hover:text-studio-text border border-studio-border rounded-lg transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 pb-12">
        {/* ─── Create Agent Wizard ─── */}
        {showCreate && (
          <CreateWizard
            onComplete={handleWizardComplete}
            onCancel={() => setShowCreate(false)}
          />
        )}

        {/* ─── Agent List ─── */}
        {!showCreate && (
          <>
            {loading && (
              <div className="grid grid-cols-2 gap-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="p-4 rounded-xl border border-studio-border bg-studio-card animate-pulse">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-11 h-11 rounded-xl bg-studio-border" />
                      <div className="flex-1 min-w-0">
                        <div className="h-4 bg-studio-border rounded w-3/4 mb-1.5" />
                        <div className="h-3 bg-studio-border/60 rounded w-1/2" />
                      </div>
                    </div>
                    <div className="h-3 bg-studio-border/40 rounded w-16 mt-1" />
                  </div>
                ))}
              </div>
            )}

            {!loading && error && (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="w-16 h-16 rounded-2xl bg-studio-live/10 border border-studio-live/20 flex items-center justify-center text-2xl mb-4">!</div>
                <p className="text-studio-text text-sm font-medium mb-1">Something went wrong</p>
                <p className="text-studio-muted text-xs mb-4">{error}</p>
                <button onClick={loadAgents} className="text-sm px-4 py-2 bg-studio-accent text-white rounded-lg hover:bg-studio-accent-hover transition-colors">
                  Try again
                </button>
              </div>
            )}

            {!loading && !error && agents.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16">
                <img src={imgCustom} alt="" className="w-24 h-24 mb-4 opacity-80" draggable={false} />
                <h2 className="text-lg text-studio-text font-semibold mb-1">No agents yet</h2>
                <p className="text-studio-muted text-sm mb-6 text-center max-w-xs">Create your first AI agent and start streaming in minutes.</p>
                <button
                  onClick={() => setShowCreate(true)}
                  className="px-6 py-3 bg-studio-accent text-white font-semibold rounded-lg hover:bg-studio-accent-hover transition-all shadow-sm shadow-studio-accent/20"
                >
                  Create your first agent
                </button>
              </div>
            )}

            {!loading && !error && agents.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                {agents.map((agent) => {
                  const isExternal = agent.streamingMode === 'external';
                  const isSelecting = selecting === agent.id;

                  return (
                    <button
                      key={agent.id}
                      onClick={() => selectAgent(agent)}
                      disabled={!isExternal || !!isSelecting}
                      className={`text-left p-4 rounded-xl border transition-all group ${
                        isExternal
                          ? 'border-studio-border bg-studio-card hover:border-studio-accent hover:shadow-lg hover:shadow-studio-accent/5 cursor-pointer'
                          : 'border-studio-border/50 bg-studio-card/50 opacity-40 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-11 h-11 rounded-xl bg-studio-bg border border-studio-border overflow-hidden shrink-0 group-hover:border-studio-accent/50 transition-colors">
                          <img
                            src={agent.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${agent.slug}`}
                            alt={agent.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-studio-text truncate group-hover:text-studio-accent transition-colors">{agent.name}</p>
                          <p className="text-[11px] text-studio-muted truncate">liveclaw.tv/{agent.slug}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={agent.status} />
                        {!isExternal && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-studio-border/60 text-studio-muted">managed</span>
                        )}
                      </div>
                      {isSelecting && (
                        <p className="text-xs text-studio-accent mt-2">Setting up...</p>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  let color = 'bg-studio-border text-studio-muted';
  if (status === 'live') color = 'bg-studio-live/20 text-studio-live';
  else if (status === 'online') color = 'bg-studio-success/20 text-studio-success';

  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded ${color}`}>
      {status}
    </span>
  );
}
