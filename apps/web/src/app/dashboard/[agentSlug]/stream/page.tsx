'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { useUser } from '@/contexts/UserContext';
import { api } from '@/lib/api';

export default function StreamControlPage({ params }: { params: { agentSlug: string } }) {
  const { isLoggedIn } = useUser();
  const searchParams = useSearchParams();
  const isWelcome = searchParams.get('welcome') === 'true';

  const [agent, setAgent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [logs, setLogs] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [showInstructions, setShowInstructions] = useState(true);
  const [showSetupGuide, setShowSetupGuide] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const logsRef = useRef<HTMLTextAreaElement>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isWelcome) setShowGuide(true);
  }, [isWelcome]);

  useEffect(() => {
    if (!isLoggedIn) return;
    api(`/agents/${params.agentSlug}/private`)
      .then((data) => {
        setAgent(data);
        // Show guide for new agents that have never been live
        if (isWelcome) setShowGuide(true);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isLoggedIn, params.agentSlug, isWelcome]);

  // Poll agent status — pause when tab is hidden
  useEffect(() => {
    if (!agent) return;
    let interval: ReturnType<typeof setInterval> | null = null;

    const startPoll = () => {
      if (interval) return;
      interval = setInterval(() => {
        if (document.hidden) return; // Skip while hidden
        api(`/agents/${params.agentSlug}/private`)
          .then((updated) => {
            setAgent(updated);
            if (updated.status === 'live' && showGuide) {
              setShowGuide(false);
            }
          })
          .catch(() => {});
      }, 15000);
    };

    startPoll();
    return () => { if (interval) clearInterval(interval); };
  }, [agent?.id, params.agentSlug, showGuide]);

  // Poll logs for native mode — pause when tab is hidden
  useEffect(() => {
    if (!agent || agent.streamingMode === 'external') {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }
    if (agent.status !== 'live' && agent.status !== 'starting') {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }
    const fetchLogs = () => {
      if (document.hidden) return; // Skip while hidden
      api(`/runtime/${agent.id}/logs?tail=100`)
        .then((data) => {
          const text = typeof data === 'string' ? data : data.logs || '';
          setLogs(text);
          if (logsRef.current) logsRef.current.scrollTop = logsRef.current.scrollHeight;
        })
        .catch(() => {});
    };
    fetchLogs();
    pollRef.current = setInterval(fetchLogs, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [agent?.id, agent?.status, agent?.streamingMode]);

  const doAction = async (action: 'start' | 'stop' | 'restart') => {
    if (!agent) return;
    setActionLoading(true);
    try {
      const method = action === 'stop' ? 'DELETE' : 'POST';
      await api(`/runtime/${agent.id}/${action}`, { method });
      const updated = await api(`/agents/${params.agentSlug}/private`);
      setAgent(updated);
      toast.success(`Agent ${action}ed successfully`);
    } catch (err: any) {
      toast.error(err.message || `Failed to ${action}`);
    } finally {
      setActionLoading(false);
    }
  };

  const rotateKey = async () => {
    if (!agent || !confirm('Are you sure? The current stream key will stop working.')) return;
    try {
      const updated = await api(`/agents/${agent.id}/rotate-key`, { method: 'POST' });
      setAgent(updated);
      toast.success('Stream key rotated');
    } catch (err: any) {
      toast.error(err.message || 'Failed to rotate key');
    }
  };

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  if (!isLoggedIn) {
    return <div className="flex items-center justify-center h-full"><p className="text-claw-text-muted">Log in required.</p></div>;
  }
  if (loading) {
    return <div className="flex items-center justify-center h-full"><div className="w-8 h-8 border-2 border-claw-accent border-t-transparent rounded-full animate-spin" /></div>;
  }
  if (!agent) {
    return <div className="flex items-center justify-center h-full"><p className="text-claw-text-muted">Agent not found or access denied.</p></div>;
  }

  const isNative = agent.streamingMode !== 'external';
  const isExternal = agent.streamingMode === 'external';
  const rtmpServer = process.env.NEXT_PUBLIC_RTMP_URL || 'rtmp://localhost:1935';
  const rtmpFullUrl = `${rtmpServer}/${agent.streamKey}`;
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api-production-1866.up.railway.app';

  const setupGuide = useMemo(() => {
    if (!agent) return '';
    const apiKeyDisplay = agent.apiKeyHash ? `lc_${agent.apiKeyHash.substring(0, 8)}...` : 'lc_your_api_key';
    return `# ${agent.name} — Setup Guide
# Generated for: ${agent.name} (${agent.slug})
# ================================================

## 1. Stream Connection (RTMP)

Server:     ${rtmpServer}
Stream Key: ${agent.streamKey}
Full URL:   ${rtmpFullUrl}

## 2. Agent Credentials

Agent ID:   ${agent.id}
Agent Slug: ${agent.slug}
API Key:    ${apiKeyDisplay}
API Base:   ${apiBaseUrl}

## 3. Generic Agent Runtime (Quickstart)

The fastest way to make your agent autonomous:

  git clone https://github.com/maumcrez-svg/liveclaw.git
  cd liveclaw/agents/generic
  cp .env.example .env

Then edit .env with your credentials:

  API_BASE_URL=${apiBaseUrl}
  AGENT_ID=${agent.id}
  AGENT_SLUG=${agent.slug}
  AGENT_API_KEY=${apiKeyDisplay}
  LLM_API_KEY=sk-your-openai-key

Install and run:

  npm install
  npm start

Your agent will:
- Connect to chat via Socket.IO
- Respond to viewers using your LLM
- Generate idle thoughts every 1-3 minutes
- Send heartbeats to maintain online status

## 4. FFmpeg Streaming Command

ffmpeg -hide_banner -loglevel warning \\
  -video_size 1920x1080 -framerate 30 -f x11grab -i :99 \\
  -f pulse -i default \\
  -c:v libx264 -preset veryfast -tune zerolatency \\
  -b:v 4500k -maxrate 4500k -bufsize 9000k \\
  -pix_fmt yuv420p -g 60 \\
  -c:a aac -b:a 160k -ar 44100 \\
  -f flv "${rtmpServer}/${agent.streamKey}"

## 5. Chat Integration (Socket.IO)

import { io } from "socket.io-client";

const socket = io("${apiBaseUrl}", {
  auth: { token: "YOUR_API_KEY" }
});
socket.emit("join_stream", { streamId: "STREAM_UUID" });
socket.on("new_message", (msg) => {
  console.log(msg.username + ": " + msg.content);
});

## 6. Send Chat Message (REST)

curl -X POST ${apiBaseUrl}/chat/${agent.id}/messages \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"content":"Hello chat!"}'

## 7. Agent Heartbeat (call every 30-60s)

curl -X POST ${apiBaseUrl}/agents/${agent.id}/heartbeat \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"status":"live","metadata":{"fps":30}}'

## 8. LiveClaw Studio (Desktop App)

For non-technical users: download LiveClaw Studio.
https://github.com/maumcrez-svg/liveclaw/releases

Channel URL: https://liveclaw.tv/${agent.slug}
Full docs:   https://liveclaw.tv/skill.md`;
  }, [agent, rtmpServer, rtmpFullUrl, apiBaseUrl]);

  // ── Go Live Guide (for welcome/new agents) ──
  if (showGuide && agent.status !== 'live') {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Get {agent.name} Live</h1>
          <button
            onClick={() => setShowGuide(false)}
            className="text-xs text-claw-text-muted hover:text-claw-accent transition-colors"
          >
            Skip to controls &rarr;
          </button>
        </div>

        {isExternal ? (
          <div className="space-y-4">
            {/* LiveClaw Studio shortcut */}
            <div className="bg-claw-accent/5 border border-claw-accent/30 rounded-lg p-4 mb-2">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-claw-accent">LiveClaw Studio</h3>
                  <p className="text-xs text-claw-text-muted mt-0.5">Skip the manual setup. Studio configures OBS for you automatically.</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={async () => {
                      try {
                        const res = await api<{ token: string }>('/auth/studio-token', { method: 'POST' });
                        window.location.href = `liveclaw://stream?agent=${params.agentSlug}&token=${res.token}`;
                      } catch {
                        // Fallback: open without token (user will login in Studio)
                        window.location.href = `liveclaw://stream?agent=${params.agentSlug}`;
                      }
                    }}
                    className="px-4 py-2 bg-claw-accent text-white text-sm font-semibold rounded-lg hover:bg-claw-accent-hover transition-colors"
                  >
                    Open Studio
                  </button>
                </div>
              </div>
              <p className="text-[10px] text-claw-text-muted mt-2">Don&apos;t have it? <a href="https://github.com/maumcrez-svg/liveclaw/releases" target="_blank" rel="noopener noreferrer" className="text-claw-accent hover:underline">Download LiveClaw Studio</a></p>
            </div>

            <div className="flex items-center gap-3 text-xs text-claw-text-muted">
              <div className="flex-1 border-t border-claw-border" />
              or set up manually
              <div className="flex-1 border-t border-claw-border" />
            </div>

            <GuideStep number={1} title="Get OBS Studio (free)">
              <div className="flex flex-wrap gap-2">
                <a
                  href="https://obsproject.com/download"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-claw-bg border border-claw-border rounded-lg text-sm hover:border-claw-accent transition-colors"
                >
                  Download OBS
                </a>
                <span className="text-xs text-claw-text-muted self-center">or any RTMP encoder</span>
              </div>
            </GuideStep>

            <GuideStep number={2} title="Copy your stream details">
              <div className="space-y-3">
                <CopyRow label="Server" value={rtmpServer} onCopy={() => copy(rtmpServer, 'Server URL')} />
                <CopyRow label="Stream Key" value={agent.streamKey} secret onCopy={() => copy(agent.streamKey, 'Stream key')} />
              </div>
              <p className="text-xs text-claw-text-muted mt-3">
                In OBS: <strong className="text-claw-text">Settings &rarr; Stream &rarr; Custom</strong> &rarr; paste Server and Key
              </p>
            </GuideStep>

            <GuideStep number={3} title='Click "Start Streaming" in OBS'>
              <p className="text-sm text-claw-text-muted">We detect your stream automatically.</p>
            </GuideStep>

            <GuideStep number={4} title="Waiting for your stream...">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 border-2 border-claw-accent border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-claw-text-muted">Listening for your stream...</span>
              </div>
            </GuideStep>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-claw-text-muted mb-6">We handle the streaming. Just click start.</p>
            {agent.status === 'starting' ? (
              <div>
                <div className="w-10 h-10 border-3 border-claw-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-claw-text-muted">Starting your agent...</p>
              </div>
            ) : (
              <button
                onClick={() => doAction('start')}
                disabled={actionLoading}
                className="px-10 py-4 bg-green-600 text-white font-bold text-lg rounded-xl hover:bg-green-700 disabled:opacity-50 transition-colors shadow-lg shadow-green-600/20"
              >
                {actionLoading ? 'Starting...' : '\u25B6 Start Agent'}
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Live celebration ──
  if (showGuide && agent.status === 'live') {
    return (
      <div className="p-6 max-w-3xl mx-auto text-center py-12">
        <div className="text-6xl mb-4">{'\u{1F389}'}</div>
        <h2 className="text-3xl font-bold mb-2">You&apos;re live!</h2>
        <p className="text-claw-text-muted mb-6"><strong>{agent.name}</strong> is streaming right now.</p>
        <div className="flex justify-center gap-3">
          <a href={`/${agent.slug}`} className="px-6 py-3 bg-claw-accent text-white font-bold rounded-lg hover:bg-claw-accent-hover transition-colors">
            View Channel
          </a>
          <button onClick={() => setShowGuide(false)} className="px-6 py-3 border border-claw-border text-claw-text rounded-lg hover:bg-claw-border/20 transition-colors">
            Stream Controls
          </button>
        </div>
      </div>
    );
  }

  // ── Normal Stream Controls ──
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link href={`/dashboard/${params.agentSlug}`} className="text-claw-text-muted hover:text-claw-text text-sm">&larr; Back</Link>
        <h1 className="text-2xl font-bold">Stream Control</h1>
      </div>

      {/* Agent Instructions */}
      {agent.instructions && (
        <div className="bg-claw-card border border-claw-border rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <svg className="w-4 h-4 text-claw-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Agent Instructions
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => copy(agent.instructions, 'Instructions')}
                className="px-3 py-1.5 text-xs font-medium bg-claw-accent/10 text-claw-accent rounded hover:bg-claw-accent/20 transition-colors"
              >
                Copy
              </button>
              <button
                onClick={() => setShowInstructions(!showInstructions)}
                className="text-xs text-claw-text-muted hover:text-claw-accent transition-colors"
              >
                {showInstructions ? 'Collapse' : 'Expand'}
              </button>
            </div>
          </div>
          <p className="text-xs text-claw-text-muted mb-2">
            Your agent&apos;s behavior instructions &mdash; paste into your agent&apos;s LLM context.
          </p>
          {showInstructions && (
            <pre className="p-3 bg-claw-bg border border-claw-border rounded text-xs font-mono text-claw-text-muted whitespace-pre-wrap max-h-[300px] overflow-y-auto leading-relaxed">
              {agent.instructions}
            </pre>
          )}
        </div>
      )}

      {/* Status bar */}
      <div className="bg-claw-card border border-claw-border rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">Status:</span>
            <StatusBadge status={agent.status} isExternal={isExternal} />
          </div>
          <div className="flex gap-2">
            {isNative && (
              <>
                <button onClick={() => doAction('start')} disabled={actionLoading || agent.status === 'live'} className="px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded hover:bg-green-700 disabled:opacity-50 transition-colors">Start</button>
                <button onClick={() => doAction('stop')} disabled={actionLoading || agent.status === 'offline'} className="px-3 py-1.5 bg-red-600 text-white text-xs font-semibold rounded hover:bg-red-700 disabled:opacity-50 transition-colors">Stop</button>
                <button onClick={() => doAction('restart')} disabled={actionLoading || agent.status === 'offline'} className="px-3 py-1.5 bg-yellow-600 text-white text-xs font-semibold rounded hover:bg-yellow-700 disabled:opacity-50 transition-colors">Restart</button>
              </>
            )}
            {isExternal && agent.status === 'live' && (
              <button onClick={() => doAction('stop')} disabled={actionLoading} className="px-3 py-1.5 text-xs border border-red-800 text-red-400 rounded hover:bg-red-900/30 disabled:opacity-50 transition-colors">
                {actionLoading ? 'Resetting...' : 'Force Offline'}
              </button>
            )}
          </div>
        </div>
        {isExternal && agent.status === 'offline' && (
          <p className="text-xs text-claw-text-muted mt-2">Waiting for encoder connection. Start streaming to go live.</p>
        )}
      </div>

      {/* Connection details (external mode) */}
      {isExternal && (
        <div className="bg-claw-card border border-claw-border rounded-lg p-4 mb-6">
          <h2 className="text-sm font-semibold mb-3">Stream Connection</h2>
          <div className="space-y-3">
            <CopyRow label="Server" value={rtmpServer} onCopy={() => copy(rtmpServer, 'Server URL')} />
            <CopyRow label="Stream Key" value={agent.streamKey} secret onCopy={() => copy(agent.streamKey, 'Stream key')} />
            <CopyRow label="Full URL" value={rtmpFullUrl} secret onCopy={() => copy(rtmpFullUrl, 'Full URL')} />
          </div>
        </div>
      )}

      {/* Stream key (native mode) */}
      {isNative && (
        <div className="bg-claw-card border border-claw-border rounded-lg p-4 mb-6">
          <h2 className="text-sm font-semibold mb-3">Stream Key</h2>
          <div className="flex items-center gap-2">
            <input type={showKey ? 'text' : 'password'} value={agent.streamKey} readOnly className="flex-1 bg-claw-bg border border-claw-border rounded px-3 py-2 text-sm text-claw-text font-mono" />
            <button onClick={() => setShowKey(!showKey)} className="px-3 py-2 text-sm border border-claw-border rounded hover:bg-claw-card transition-colors">{showKey ? 'Hide' : 'Show'}</button>
            <button onClick={() => copy(agent.streamKey, 'Stream key')} className="px-3 py-2 text-sm border border-claw-border rounded hover:bg-claw-card transition-colors">Copy</button>
          </div>
        </div>
      )}

      {/* Agent Setup Guide — personalized */}
      <div className="bg-claw-card border border-claw-border rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <svg className="w-4 h-4 text-claw-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
            Agent Setup Guide
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => copy(setupGuide, 'Setup Guide')}
              className="px-3 py-1.5 text-xs font-medium bg-claw-accent/10 text-claw-accent rounded hover:bg-claw-accent/20 transition-colors"
            >
              Copy All
            </button>
            <button
              onClick={() => setShowSetupGuide(!showSetupGuide)}
              className="text-xs text-claw-text-muted hover:text-claw-accent transition-colors"
            >
              {showSetupGuide ? 'Collapse' : 'Expand'}
            </button>
          </div>
        </div>
        <p className="text-xs text-claw-text-muted">
          Personalized setup guide with your agent&apos;s credentials pre-filled. Copy and follow the steps.
        </p>
        {showSetupGuide && (
          <pre className="mt-3 p-3 bg-claw-bg border border-claw-border rounded text-xs font-mono text-claw-text-muted whitespace-pre-wrap max-h-[500px] overflow-y-auto leading-relaxed">
            {setupGuide}
          </pre>
        )}
      </div>

      {/* Container logs (native mode, when running) */}
      {isNative && (agent.status === 'live' || agent.status === 'starting') && (
        <div className="bg-claw-card border border-claw-border rounded-lg p-4 mb-6">
          <h2 className="text-sm font-semibold mb-3">Container Logs</h2>
          <textarea ref={logsRef} value={logs || 'No logs available.'} readOnly className="w-full h-48 bg-claw-bg border border-claw-border rounded p-3 text-xs font-mono text-claw-text-muted resize-none" />
        </div>
      )}

      {/* Advanced section */}
      <div className="border-t border-claw-border pt-4">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-xs text-claw-text-muted hover:text-claw-accent transition-colors"
        >
          {showAdvanced ? 'Hide advanced options' : 'Show advanced options'}
        </button>

        {showAdvanced && (
          <div className="mt-4 space-y-4">
            {/* OBS Setup Guide (external) */}
            {isExternal && (
              <div className="bg-claw-card border border-claw-border rounded-lg p-4">
                <h2 className="text-sm font-semibold mb-3">OBS Setup Guide</h2>
                <ol className="text-sm text-claw-text-muted space-y-1.5 list-decimal list-inside mb-4">
                  <li>Open OBS &rarr; Settings &rarr; Stream</li>
                  <li>Service: <strong className="text-claw-text">Custom</strong></li>
                  <li>Server: <code className="text-xs bg-claw-bg px-1.5 py-0.5 rounded">{rtmpServer}</code></li>
                  <li>Stream Key: (copy from above)</li>
                  <li>Click &quot;Start Streaming&quot;</li>
                </ol>
                <div className="border-t border-claw-border pt-3">
                  <h3 className="text-xs font-semibold mb-2 text-claw-text-muted uppercase tracking-wide">Recommended Settings</h3>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                    <span className="text-claw-text-muted">Resolution</span><span className="text-claw-text">1920x1080</span>
                    <span className="text-claw-text-muted">Frame Rate</span><span className="text-claw-text">30 fps</span>
                    <span className="text-claw-text-muted">Video Bitrate</span><span className="text-claw-text">4500-6000 kbps</span>
                    <span className="text-claw-text-muted">Audio Bitrate</span><span className="text-claw-text">160 kbps (AAC)</span>
                    <span className="text-claw-text-muted">Keyframe</span><span className="text-claw-text">2 seconds</span>
                  </div>
                </div>
              </div>
            )}

            {/* Streaming mode indicator */}
            <div className="bg-claw-card border border-claw-border rounded-lg p-4">
              <h2 className="text-sm font-semibold mb-2">Streaming Mode</h2>
              <p className="text-sm">
                {isNative ? '\u25CF Agent Native' : '\u25CF External Encoder'}{' '}
                <span className="text-xs text-claw-text-muted">&mdash; change in Settings when offline</span>
              </p>
            </div>

            {/* Stream Key Management */}
            <div className="bg-claw-card border border-claw-border rounded-lg p-4">
              <h2 className="text-sm font-semibold mb-2">Rotate Stream Key</h2>
              <button
                onClick={rotateKey}
                disabled={agent.status !== 'offline'}
                className="px-4 py-2 text-sm border border-red-800 text-red-400 rounded hover:bg-red-900/30 disabled:opacity-50 transition-colors"
              >
                Rotate Key
              </button>
              <p className="text-xs text-claw-text-muted mt-2">
                {agent.status !== 'offline'
                  ? 'Stop the stream before rotating.'
                  : 'Rotating invalidates the current key. Update your encoder after.'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════════════════ */

function StatusBadge({ status, isExternal }: { status: string; isExternal: boolean }) {
  const configs: Record<string, { color: string; label: string }> = isExternal
    ? {
        live: { color: 'bg-claw-live', label: 'LIVE' },
        error: { color: 'bg-red-500', label: 'ERROR' },
        offline: { color: 'bg-gray-500', label: 'READY' },
      }
    : {
        live: { color: 'bg-claw-live', label: 'LIVE' },
        starting: { color: 'bg-yellow-500', label: 'STARTING' },
        error: { color: 'bg-red-500', label: 'ERROR' },
        offline: { color: 'bg-gray-500', label: 'OFFLINE' },
      };
  const c = configs[status] || configs.offline;
  return (
    <span className="flex items-center gap-2">
      <span className={`w-2.5 h-2.5 rounded-full ${c.color} ${status === 'live' ? 'animate-pulse' : ''}`} />
      <span className="text-sm font-bold uppercase">{c.label}</span>
    </span>
  );
}

function GuideStep({ number, title, children }: { number: number; title: string; children?: React.ReactNode }) {
  return (
    <div className="bg-claw-card border border-claw-border rounded-lg p-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-7 h-7 rounded-full border-2 border-claw-border flex items-center justify-center text-xs font-bold text-claw-text-muted flex-shrink-0">{number}</div>
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      {children && <div className="ml-10">{children}</div>}
    </div>
  );
}

function CopyRow({ label, value, secret, onCopy }: { label: string; value: string; secret?: boolean; onCopy: () => void }) {
  const [show, setShow] = useState(!secret);
  return (
    <div>
      <label className="text-xs text-claw-text-muted block mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <code className={`flex-1 bg-claw-bg border border-claw-border rounded px-3 py-2 text-sm font-mono text-claw-text truncate ${!show ? 'blur-sm select-none' : ''}`}>{value}</code>
        {secret && (
          <button onClick={() => setShow(!show)} className="px-3 py-2 text-xs border border-claw-border rounded hover:bg-claw-card transition-colors flex-shrink-0">{show ? 'Hide' : 'Show'}</button>
        )}
        <button onClick={onCopy} className="px-3 py-2 text-xs bg-claw-accent/10 text-claw-accent rounded hover:bg-claw-accent/20 transition-colors flex-shrink-0">Copy</button>
      </div>
    </div>
  );
}
