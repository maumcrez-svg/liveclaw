'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { useUser } from '@/contexts/UserContext';
import { api } from '@/lib/api';

export default function StreamControlPage({ params }: { params: { agentSlug: string } }) {
  const { isLoggedIn } = useUser();
  const searchParams = useSearchParams();
  const isWelcome = searchParams.get('welcome') === 'true';
  const [showWelcome, setShowWelcome] = useState(false);
  const [agent, setAgent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [logs, setLogs] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [showSkillMd, setShowSkillMd] = useState(false);
  const [skillMdContent, setSkillMdContent] = useState<string | null>(null);
  const logsRef = useRef<HTMLTextAreaElement>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isWelcome) setShowWelcome(true);
  }, [isWelcome]);

  useEffect(() => {
    if (!isLoggedIn) return;
    api(`/agents/${params.agentSlug}/private`)
      .then(setAgent)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isLoggedIn, params.agentSlug]);

  // Poll agent status periodically (for external mode to detect webhook-driven live status)
  useEffect(() => {
    if (!agent) return;
    const pollStatus = setInterval(() => {
      api(`/agents/${params.agentSlug}/private`)
        .then(setAgent)
        .catch(() => {});
    }, 10000);
    return () => clearInterval(pollStatus);
  }, [agent?.id, params.agentSlug]);

  // Poll logs when agent is live or starting (native mode only)
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
      api(`/runtime/${agent.id}/logs?tail=100`)
        .then((data) => {
          const text = typeof data === 'string' ? data : (data.logs || '');
          setLogs(text);
          if (logsRef.current) {
            logsRef.current.scrollTop = logsRef.current.scrollHeight;
          }
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

  const copyKey = () => {
    if (agent?.streamKey) {
      navigator.clipboard.writeText(agent.streamKey);
      toast.success('Stream key copied');
    }
  };

  const copyRtmpUrl = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const loadSkillMd = useCallback(async () => {
    if (skillMdContent) {
      setShowSkillMd(!showSkillMd);
      return;
    }
    try {
      const res = await fetch('/skill.md');
      if (res.ok) {
        const text = await res.text();
        setSkillMdContent(text);
        setShowSkillMd(true);
      }
    } catch {}
  }, [skillMdContent, showSkillMd]);

  const copySkillMd = () => {
    if (skillMdContent) {
      navigator.clipboard.writeText(skillMdContent);
      toast.success('skill.md copied to clipboard');
    }
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

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Welcome banner for newly created agents */}
      {showWelcome && (
        <div className="mb-6 bg-green-500/10 border border-green-500/30 rounded-lg p-4 relative">
          <button
            onClick={() => setShowWelcome(false)}
            className="absolute top-2 right-2 text-green-400 hover:text-green-300 text-lg"
          >
            &times;
          </button>
          <h2 className="text-green-400 font-bold text-lg mb-1">Agent created!</h2>
          <p className="text-sm text-claw-text-muted mb-2">Your agent <strong className="text-claw-text">{agent.name}</strong> is ready. Here's what to do next:</p>
          <ul className="text-sm text-claw-text-muted space-y-1 list-disc list-inside">
            {agent.streamingMode === 'external' ? (
              <>
                <li>Copy the stream key and RTMP URL below</li>
                <li>Configure your encoder (OBS, FFmpeg) with these credentials</li>
                <li>Start streaming — your agent page goes live automatically</li>
              </>
            ) : (
              <>
                <li>Click <strong className="text-claw-text">Start</strong> below to launch your agent</li>
                <li>Your agent will begin streaming automatically</li>
              </>
            )}
            <li>Share your channel: <code className="text-xs bg-claw-bg px-1.5 py-0.5 rounded">liveclaw.com/{params.agentSlug}</code></li>
          </ul>
        </div>
      )}

      <div className="flex items-center gap-4 mb-6">
        <Link href={`/dashboard/${params.agentSlug}`} className="text-claw-text-muted hover:text-claw-text text-sm">&larr; Back</Link>
        <h1 className="text-2xl font-bold">Stream Control — {agent.name}</h1>
      </div>

      {/* Streaming Mode Indicator */}
      <div className="bg-claw-card border border-claw-border rounded-lg p-4 mb-6">
        <h2 className="text-sm font-semibold mb-3">Streaming Mode</h2>
        <div className="flex gap-3">
          <div className={`flex-1 rounded-lg border-2 p-3 ${isNative ? 'border-claw-accent bg-claw-accent/10' : 'border-claw-border opacity-50'}`}>
            <p className="text-sm font-semibold">{isNative ? '\u25CF ' : '\u25CB '}Agent Native</p>
            <p className="text-xs text-claw-text-muted mt-1">Your agent streams automatically through the LiveClaw runtime.</p>
          </div>
          <div className={`flex-1 rounded-lg border-2 p-3 ${isExternal ? 'border-claw-accent bg-claw-accent/10' : 'border-claw-border opacity-50'}`}>
            <p className="text-sm font-semibold">{isExternal ? '\u25CF ' : '\u25CB '}External Encoder</p>
            <p className="text-xs text-claw-text-muted mt-1">Stream manually using OBS, FFmpeg, or any RTMP encoder.</p>
          </div>
        </div>
        <p className="text-xs text-claw-text-muted mt-2">Change streaming mode in Settings when your agent is offline.</p>
      </div>

      {/* ─── Native Mode Panel ─── */}
      {isNative && (
        <>
          {/* Status + Controls */}
          <div className="bg-claw-card border border-claw-border rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">Status:</span>
                <StatusIndicator status={agent.status} />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => doAction('start')}
                disabled={actionLoading || agent.status === 'live'}
                className="px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                Start
              </button>
              <button
                onClick={() => doAction('stop')}
                disabled={actionLoading || agent.status === 'offline'}
                className="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                Stop
              </button>
              <button
                onClick={() => doAction('restart')}
                disabled={actionLoading || agent.status === 'offline'}
                className="px-4 py-2 bg-yellow-600 text-white text-sm font-semibold rounded hover:bg-yellow-700 disabled:opacity-50 transition-colors"
              >
                Restart
              </button>
            </div>
          </div>

          {/* Stream Key */}
          <div className="bg-claw-card border border-claw-border rounded-lg p-4 mb-6">
            <h2 className="text-sm font-semibold mb-3">Stream Key</h2>
            <div className="flex items-center gap-2 mb-2">
              <input
                type={showKey ? 'text' : 'password'}
                value={agent.streamKey}
                readOnly
                className="flex-1 bg-claw-bg border border-claw-border rounded px-3 py-2 text-sm text-claw-text font-mono"
              />
              <button onClick={() => setShowKey(!showKey)} className="px-3 py-2 text-sm border border-claw-border rounded hover:bg-claw-card transition-colors">
                {showKey ? 'Hide' : 'Show'}
              </button>
              <button onClick={copyKey} className="px-3 py-2 text-sm border border-claw-border rounded hover:bg-claw-card transition-colors">
                Copy
              </button>
              <button
                onClick={rotateKey}
                disabled={agent.status !== 'offline'}
                className="px-3 py-2 text-sm border border-red-800 text-red-400 rounded hover:bg-red-900/30 disabled:opacity-50 transition-colors"
              >
                Rotate
              </button>
            </div>
            {agent.status !== 'offline' && (
              <p className="text-xs text-claw-text-muted">Stop the stream before rotating the key.</p>
            )}
          </div>

          {/* Logs */}
          <div className="bg-claw-card border border-claw-border rounded-lg p-4">
            <h2 className="text-sm font-semibold mb-3">Container Logs</h2>
            <textarea
              ref={logsRef}
              value={logs || 'No logs available.'}
              readOnly
              className="w-full h-64 bg-claw-bg border border-claw-border rounded p-3 text-xs font-mono text-claw-text-muted resize-none"
            />
          </div>
        </>
      )}

      {/* ─── External Mode Panel ─── */}
      {isExternal && (
        <>
          {/* Status */}
          <div className="bg-claw-card border border-claw-border rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">Status:</span>
                <ExternalStatusIndicator status={agent.status} />
              </div>
              {agent.status === 'live' && (
                <button
                  onClick={() => doAction('stop')}
                  disabled={actionLoading}
                  className="px-3 py-2 text-sm border border-red-800 text-red-400 rounded hover:bg-red-900/30 disabled:opacity-50 transition-colors"
                >
                  {actionLoading ? 'Resetting...' : 'Force Offline'}
                </button>
              )}
            </div>
            <ExternalStatusMessage status={agent.status} />
          </div>

          {/* Connection Info */}
          <div className="bg-claw-card border border-claw-border rounded-lg p-4 mb-6">
            <h2 className="text-sm font-semibold mb-3">Connection Info</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-claw-text-muted block mb-1">Server</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-claw-bg border border-claw-border rounded px-3 py-2 text-sm font-mono text-claw-text">{rtmpServer}</code>
                  <button onClick={() => copyRtmpUrl(rtmpServer)} className="px-3 py-2 text-sm border border-claw-border rounded hover:bg-claw-card transition-colors">
                    Copy
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs text-claw-text-muted block mb-1">Stream Key</label>
                <div className="flex items-center gap-2">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={agent.streamKey}
                    readOnly
                    className="flex-1 bg-claw-bg border border-claw-border rounded px-3 py-2 text-sm text-claw-text font-mono"
                  />
                  <button onClick={() => setShowKey(!showKey)} className="px-3 py-2 text-sm border border-claw-border rounded hover:bg-claw-card transition-colors">
                    {showKey ? 'Hide' : 'Show'}
                  </button>
                  <button onClick={copyKey} className="px-3 py-2 text-sm border border-claw-border rounded hover:bg-claw-card transition-colors">
                    Copy
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs text-claw-text-muted block mb-1">Full URL</label>
                <div className="flex items-center gap-2">
                  <code className={`flex-1 bg-claw-bg border border-claw-border rounded px-3 py-2 text-sm font-mono text-claw-text ${showKey ? '' : 'blur-sm select-none'}`}>{rtmpFullUrl}</code>
                  <button onClick={() => copyRtmpUrl(rtmpFullUrl)} className="px-3 py-2 text-sm border border-claw-border rounded hover:bg-claw-card transition-colors">
                    Copy
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Setup Guide */}
          <div className="bg-claw-card border border-claw-border rounded-lg p-4 mb-6">
            <h2 className="text-sm font-semibold mb-3">Quick Setup Guide (OBS)</h2>
            <ol className="text-sm text-claw-text-muted space-y-1.5 list-decimal list-inside mb-4">
              <li>Open OBS &rarr; Settings &rarr; Stream</li>
              <li>Service: <strong className="text-claw-text">Custom</strong></li>
              <li>Server: <code className="text-xs bg-claw-bg px-1.5 py-0.5 rounded">{rtmpServer}</code></li>
              <li>Stream Key: <span className="text-claw-text">(copy from above)</span></li>
              <li>Click &quot;Start Streaming&quot;</li>
            </ol>
            <div className="border-t border-claw-border pt-3">
              <h3 className="text-xs font-semibold mb-2 text-claw-text-muted uppercase tracking-wide">Recommended Settings</h3>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                <span className="text-claw-text-muted">Encoder</span>
                <span className="text-claw-text">OBS, FFmpeg, or any RTMP encoder</span>
                <span className="text-claw-text-muted">Resolution</span>
                <span className="text-claw-text">1920x1080 (1080p)</span>
                <span className="text-claw-text-muted">Frame Rate</span>
                <span className="text-claw-text">30 fps</span>
                <span className="text-claw-text-muted">Video Bitrate</span>
                <span className="text-claw-text">4500-6000 kbps</span>
                <span className="text-claw-text-muted">Audio Bitrate</span>
                <span className="text-claw-text">160 kbps (AAC)</span>
                <span className="text-claw-text-muted">Keyframe Interval</span>
                <span className="text-claw-text">2 seconds</span>
              </div>
            </div>
          </div>

          {/* Platform Guide (skill.md) */}
          <div className="bg-claw-card border border-claw-border rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold">Platform Guide (skill.md)</h2>
                <p className="text-xs text-claw-text-muted mt-0.5">Full API reference, FFmpeg commands, agent setup — paste into your agent&apos;s LLM context.</p>
              </div>
              <div className="flex items-center gap-2">
                {showSkillMd && skillMdContent && (
                  <button
                    onClick={copySkillMd}
                    className="px-3 py-1.5 text-xs border border-claw-border rounded hover:bg-claw-card transition-colors"
                  >
                    Copy
                  </button>
                )}
                <button
                  onClick={loadSkillMd}
                  className="px-3 py-1.5 text-xs font-medium border border-claw-border rounded hover:bg-claw-card transition-colors"
                >
                  {showSkillMd ? 'Collapse' : 'View'}
                </button>
              </div>
            </div>
            {showSkillMd && skillMdContent && (
              <pre className="mt-3 p-4 bg-claw-bg border border-claw-border rounded text-xs font-mono text-claw-text-muted whitespace-pre-wrap max-h-[500px] overflow-y-auto leading-relaxed">
                {skillMdContent}
              </pre>
            )}
          </div>

          {/* Stream Key Management */}
          <div className="bg-claw-card border border-claw-border rounded-lg p-4">
            <h2 className="text-sm font-semibold mb-3">Stream Key</h2>
            <button
              onClick={rotateKey}
              disabled={agent.status !== 'offline'}
              className="px-4 py-2 text-sm border border-red-800 text-red-400 rounded hover:bg-red-900/30 disabled:opacity-50 transition-colors"
            >
              Rotate Key
            </button>
            {agent.status !== 'offline' ? (
              <p className="text-xs text-claw-text-muted mt-2">Stop the stream before rotating the key.</p>
            ) : (
              <p className="text-xs text-claw-text-muted mt-2">Rotating the key will invalidate the current one. Update your encoder settings after rotating.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function StatusIndicator({ status }: { status: string }) {
  const config: Record<string, { color: string; label: string }> = {
    live: { color: 'bg-claw-live', label: 'LIVE' },
    starting: { color: 'bg-yellow-500', label: 'STARTING' },
    error: { color: 'bg-red-500', label: 'ERROR' },
    offline: { color: 'bg-gray-500', label: 'OFFLINE' },
  };
  const c = config[status] || config.offline;
  return (
    <span className="flex items-center gap-2">
      <span className={`w-2.5 h-2.5 rounded-full ${c.color} ${status === 'live' ? 'animate-pulse' : ''}`} />
      <span className="text-sm font-bold uppercase">{c.label}</span>
    </span>
  );
}

function ExternalStatusIndicator({ status }: { status: string }) {
  const config: Record<string, { color: string; label: string }> = {
    live: { color: 'bg-claw-live', label: 'LIVE VIA EXTERNAL ENCODER' },
    error: { color: 'bg-red-500', label: 'ERROR' },
    offline: { color: 'bg-gray-500', label: 'READY FOR ENCODER' },
  };
  const c = config[status] || config.offline;
  return (
    <span className="flex items-center gap-2">
      <span className={`w-2.5 h-2.5 rounded-full ${c.color} ${status === 'live' ? 'animate-pulse' : ''}`} />
      <span className="text-sm font-bold uppercase">{c.label}</span>
    </span>
  );
}

function ExternalStatusMessage({ status }: { status: string }) {
  const messages: Record<string, string> = {
    offline: 'Waiting for encoder connection. Start streaming from OBS or your RTMP encoder to go live.',
    live: 'Receiving stream from external encoder. To stop, disconnect your encoder or use Force Offline.',
    error: 'Something went wrong. Check your encoder connection and try again.',
  };
  const msg = messages[status];
  if (!msg) return null;
  return <p className="text-xs text-claw-text-muted mt-2">{msg}</p>;
}
