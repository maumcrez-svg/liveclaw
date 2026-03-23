'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { StreamPlayer } from '@/components/player/StreamPlayer';
import { ChatPanel } from '@/components/chat/ChatPanel';
import { ChannelHeader } from '@/components/channel/ChannelHeader';
import { ChannelTabs } from '@/components/channel/ChannelTabs';
import { FollowButton } from '@/components/stream/FollowButton';
import { AgentPageSkeleton } from '@/components/ui/Skeleton';
import { AlertOverlay } from '@/components/alerts/AlertOverlay';
import { useAlertQueue } from '@/hooks/useAlertQueue';
import { useStreamAlerts } from '@/hooks/useStreamAlerts';
import { useViewerPresence } from '@/hooks/useViewerPresence';
import { useLiveViewerCounts } from '@/components/LiveViewerCounts';
import { CreateClipModal } from '@/components/clips/CreateClipModal';
import { ClipStatusToast } from '@/components/clips/ClipStatusToast';
import { useUser } from '@/contexts/UserContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const HLS_URL = process.env.NEXT_PUBLIC_HLS_URL || '/hls';

/** Polling interval for stream status when offline (waiting for stream) */
const STATUS_POLL_OFFLINE_MS = 5_000;
/** Polling interval for stream status when live (detect drops) */
const STATUS_POLL_LIVE_MS = 15_000;

function formatLastStreamed(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function StreamPage({ params }: { params: { agentSlug: string } }) {
  const [agent, setAgent] = useState<any>(null);
  const [stream, setStream] = useState<any>(null);
  const [pastStreams, setPastStreams] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Stream status tracking
  const [isLive, setIsLive] = useState(false);
  const [hlsSrc, setHlsSrc] = useState<string | null>(null);
  const [streamStatus, setStreamStatus] = useState<'loading' | 'live' | 'offline' | 'reconnecting'>('loading');

  // Player key — increment to force re-mount of StreamPlayer
  const [playerKey, setPlayerKey] = useState(0);
  const prevLiveRef = useRef(false);

  // Redirect reserved slugs
  useEffect(() => {
    if (['login', 'register', 'signin', 'signup'].includes(params.agentSlug)) {
      window.location.href = '/?auth=true';
    }
  }, [params.agentSlug]);

  // Clip editor state (mobile floating button)
  const { isLoggedIn, setShowLoginModal } = useUser();
  const [showMobileClip, setShowMobileClip] = useState(false);
  const [mobileClipToast, setMobileClipToast] = useState<string | null>(null);

  // Viewer presence — per-stream count, global fallback for initial load
  const { viewerCount: presenceCount } = useViewerPresence(stream?.id ?? null);
  const globalCounts = useLiveViewerCounts();
  // Use ?? (not ||) — 0 is a valid viewer count, only fall through on undefined/null
  const viewerCount = presenceCount > 0 ? presenceCount : (agent ? globalCounts.get(agent.id) : undefined);

  // Alert system
  const { currentAlert, phase, enqueue, dismiss } = useAlertQueue();
  const lastAlert = useStreamAlerts(stream?.id ?? null);

  useEffect(() => {
    if (lastAlert) enqueue(lastAlert);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastAlert]);

  // ─── Initial load with retry ───
  useEffect(() => {
    async function fetchWithRetry(url: string, retries = 3): Promise<Response> {
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          const res = await fetch(url);
          // 404 = definitive, don't retry
          if (res.status === 404) return res;
          // Success = done
          if (res.ok) return res;
          // Transient (429, 5xx) = retry
          if (attempt < retries) {
            await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
            continue;
          }
          return res;
        } catch (err) {
          if (attempt >= retries) throw err;
          await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
        }
      }
      throw new Error('Fetch failed');
    }

    async function loadAgent() {
      try {
        const res = await fetchWithRetry(`${API_URL}/agents/${params.agentSlug}`);
        if (res.status === 404) {
          setError('Agent not found');
          return;
        }
        if (!res.ok) {
          setError('Failed to load — please refresh');
          return;
        }
        const agentData = await res.json();
        setAgent(agentData);

        const live = agentData.status === 'live';
        setIsLive(live);
        setStreamStatus(live ? 'live' : 'offline');
        prevLiveRef.current = live;

        if (live) {
          const hlsPath = agentData.hlsPath || agentData.streamKey;
          if (hlsPath) {
            setHlsSrc(`${HLS_URL}/${hlsPath}/index.m3u8`);
          }
        }

        // Fetch streams
        const fetches: Promise<any>[] = [
          fetch(`${API_URL}/streams/agent/${agentData.id}`)
            .then((r) => r.ok ? r.json() : [])
            .catch(() => []),
        ];

        if (live) {
          fetches.push(
            fetch(`${API_URL}/streams/agent/${agentData.id}/current`)
              .then((r) => r.ok ? r.json() : null)
              .catch(() => null),
          );
        }

        const [allStreams, currentStream] = await Promise.all(fetches);
        if (currentStream) setStream(currentStream);

        const past = (allStreams || [])
          .filter((s: any) => !s.isLive)
          .slice(0, 20);
        setPastStreams(past);
      } catch {
        setError('Failed to load agent');
      }
    }
    loadAgent();
  }, [params.agentSlug]);

  // ─── Stream status polling ───
  // Polls the agent status to detect offline→live and live→offline transitions
  const pollStatus = useCallback(async () => {
    if (!agent) return;
    try {
      const res = await fetch(`${API_URL}/agents/${params.agentSlug}`);
      if (!res.ok) return;
      const data = await res.json();

      const nowLive = data.status === 'live';
      const wasLive = prevLiveRef.current;

      // Update agent data (status, hlsPath, etc.)
      setAgent(data);

      if (nowLive && !wasLive) {
        // ─── TRANSITION: offline → live ───
        console.info('[StreamPage] Stream went LIVE — initializing player');
        const hlsPath = data.hlsPath || data.streamKey;
        if (hlsPath) {
          setHlsSrc(`${HLS_URL}/${hlsPath}/index.m3u8`);
        }
        setIsLive(true);
        setStreamStatus('live');
        setPlayerKey((k) => k + 1); // Force player re-mount

        // Fetch current stream record
        try {
          const streamRes = await fetch(`${API_URL}/streams/agent/${data.id}/current`);
          if (streamRes.ok) {
            setStream(await streamRes.json());
          }
        } catch {}
      } else if (!nowLive && wasLive) {
        // ─── TRANSITION: live → offline ───
        console.info('[StreamPage] Stream went OFFLINE');
        setIsLive(false);
        setHlsSrc(null);
        setStreamStatus('reconnecting');

        // Move current stream to past
        if (stream) {
          setPastStreams((prev) => [{ ...stream, isLive: false }, ...prev].slice(0, 20));
          setStream(null);
        }
      } else if (nowLive && wasLive && !stream) {
        // ─── LIVE but no stream record yet — keep retrying ───
        try {
          const streamRes = await fetch(`${API_URL}/streams/agent/${data.id}/current`);
          if (streamRes.ok) {
            const current = await streamRes.json();
            if (current) setStream(current);
          }
        } catch {}
      } else if (!nowLive && !wasLive && streamStatus === 'reconnecting') {
        // Still offline after reconnecting state — keep waiting
      }

      prevLiveRef.current = nowLive;
    } catch {
      // Network error during poll — don't change state
    }
  }, [agent, params.agentSlug, stream, streamStatus]);

  useEffect(() => {
    if (!agent) return;

    const interval = setInterval(
      pollStatus,
      isLive ? STATUS_POLL_LIVE_MS : STATUS_POLL_OFFLINE_MS,
    );
    return () => clearInterval(interval);
  }, [agent, isLive, pollStatus]);

  // ─── Player stream-ended detection ───
  // When the player exhausts retries and gives up, switch to reconnecting state
  const handlePlayerDied = useCallback(() => {
    console.info('[StreamPage] Player reported stream ended — switching to reconnecting');
    setStreamStatus('reconnecting');
    // Don't clear hlsSrc yet — let the poll decide if stream is truly offline
  }, []);

  if (error) {
    return (
      <div className="flex items-center justify-center h-full min-h-[50vh]">
        <p className="text-claw-text-muted text-lg">{error}</p>
      </div>
    );
  }

  if (!agent) {
    return <AgentPageSkeleton />;
  }

  return (
    <div className="flex flex-col lg:flex-row lg:h-full lg:overflow-hidden">
      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0 lg:overflow-y-auto">
        <div className={`relative flex-shrink-0 ${isLive ? 'sticky top-0 z-30 lg:static' : ''}`}>
          <div className="w-full aspect-video bg-claw-bg relative">
            <AlertOverlay currentAlert={currentAlert} phase={phase} onDismiss={dismiss} />
            {/* Mobile clip button — floating on player */}
            {isLive && hlsSrc && (
              <button
                onClick={() => {
                  if (!isLoggedIn) { setShowLoginModal(true); return; }
                  setShowMobileClip(true);
                }}
                className="lg:hidden absolute bottom-3 right-3 z-20 flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-black/60 text-white border border-white/20 backdrop-blur-sm active:scale-95 transition-transform"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polygon points="10 8 16 12 10 16 10 8" />
                </svg>
                Clip
              </button>
            )}
            {hlsSrc ? (
              <StreamPlayer key={playerKey} src={hlsSrc} onStreamEnded={handlePlayerDied} />
            ) : streamStatus === 'reconnecting' ? (
              /* Reconnecting state — waiting for stream to come back */
              <div className="w-full h-full relative flex items-center justify-center bg-black">
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 relative">
                    <div className="absolute inset-0 rounded-full border-2 border-claw-accent/30 animate-spin" style={{ borderTopColor: 'var(--claw-accent)' }} />
                    <div className="absolute inset-2 rounded-full bg-black/50 flex items-center justify-center">
                      <svg className="w-6 h-6 text-claw-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 4v6h6M23 20v-6h-6" />
                        <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
                      </svg>
                    </div>
                  </div>
                  <p className="text-white font-medium mb-1">Reconnecting...</p>
                  <p className="text-white/50 text-sm">Waiting for stream to come back</p>
                </div>
              </div>
            ) : (
              /* Offline hero */
              <div className="w-full h-full relative flex items-center justify-center overflow-hidden">
                {agent.bannerUrl ? (
                  <>
                    <img src={agent.bannerUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-20 scale-110 blur-md" />
                    <div className="absolute inset-0 bg-gradient-to-t from-claw-bg via-black/80 to-black/50" />
                  </>
                ) : (
                  <>
                    <div className="absolute inset-0 bg-claw-bg" />
                    <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] rounded-full bg-claw-accent/5 blur-[100px]" />
                  </>
                )}

                <div className="relative z-10 text-center max-w-md px-6">
                  <div className="inline-block mb-5">
                    <div className="rounded-full p-1 bg-gradient-to-br from-claw-border to-claw-card shadow-2xl shadow-black/50">
                      {agent.avatarUrl ? (
                        <img src={agent.avatarUrl} alt={agent.name} className="w-28 h-28 rounded-full object-cover border-4 border-claw-bg" />
                      ) : (
                        <div className="w-28 h-28 rounded-full bg-claw-card flex items-center justify-center text-claw-text-muted text-5xl font-bold border-4 border-claw-bg">
                          {agent.name[0]?.toUpperCase()}
                        </div>
                      )}
                    </div>
                  </div>

                  <h2 className="text-2xl font-bold text-claw-text mb-2">{agent.name}</h2>
                  <span className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-claw-card/80 text-claw-text-muted text-xs font-semibold rounded-full uppercase tracking-wider border border-claw-border backdrop-blur-sm mb-2">
                    <span className="w-2 h-2 rounded-full bg-claw-text-muted/50" />
                    Offline
                  </span>

                  {pastStreams.length > 0 && pastStreams[0].startedAt && (
                    <p className="text-xs text-claw-text-muted/50 mb-3">
                      Last live {formatLastStreamed(pastStreams[0].startedAt)}
                    </p>
                  )}

                  {agent.description && (
                    <p className="text-sm text-claw-text-muted/60 line-clamp-2 mb-4">{agent.description}</p>
                  )}

                  <FollowButton agentId={agent.id} followerCount={agent.followerCount || 0} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Tabs — mobile */}
        <div className="lg:hidden">
          <ChannelTabs agent={agent} stream={stream} pastStreams={pastStreams} mobileOnly viewerCount={viewerCount} />
        </div>

        {/* Channel Header */}
        <div className={isLive ? 'hidden lg:block' : ''}>
          <ChannelHeader
            agent={{
              ...agent,
              category: agent.defaultCategory || agent.category || null,
            }}
            stream={stream}
            viewerCount={viewerCount}
            hlsSrc={hlsSrc}
          />
        </div>

        {/* Tabs — desktop */}
        <div className="hidden lg:block">
          <ChannelTabs agent={agent} stream={stream} pastStreams={pastStreams} mobileOnly={false} viewerCount={viewerCount} />
        </div>
      </div>

      {/* Chat sidebar */}
      {stream ? (
        <div className="hidden lg:flex w-[340px] border-l border-claw-border flex-shrink-0 flex-col h-[85vh] self-start">
          <ChatPanel streamId={stream.id} agentId={agent.id} agentName={agent.name} viewerCount={viewerCount} />
        </div>
      ) : (
        <div className="hidden lg:flex w-[340px] border-l border-claw-border flex-shrink-0 flex-col h-[85vh] self-start bg-claw-surface">
          <div className="px-4 py-3 border-b border-claw-border bg-gradient-to-r from-claw-surface to-claw-card/30">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-claw-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <h3 className="font-semibold text-sm">Stream Chat</h3>
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center px-8">
              <div className="relative w-16 h-16 mx-auto mb-4">
                <div className="absolute inset-0 rounded-full bg-claw-card border border-claw-border" />
                <div className="absolute inset-2 rounded-full bg-claw-surface flex items-center justify-center">
                  <svg className="w-6 h-6 text-claw-text-muted/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                <div className="absolute inset-0 rounded-full border border-claw-accent/10 animate-ping opacity-20" />
              </div>
              <p className="text-sm font-medium text-claw-text-muted mb-1">
                {streamStatus === 'reconnecting' ? 'Stream reconnecting...' : 'Chat is offline'}
              </p>
              <p className="text-xs text-claw-text-muted/40 leading-relaxed">
                {streamStatus === 'reconnecting'
                  ? 'Chat will resume when the stream comes back'
                  : <>Chat will be available when<br />{agent.name} goes live</>}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Mobile clip editor */}
      {showMobileClip && hlsSrc && (
        <CreateClipModal
          hlsSrc={hlsSrc}
          agentId={agent.id}
          streamId={stream?.id ?? null}
          agentName={agent.name}
          onClose={() => setShowMobileClip(false)}
          onCreated={(shareId) => {
            setShowMobileClip(false);
            setMobileClipToast(shareId);
          }}
        />
      )}
      {mobileClipToast && (
        <ClipStatusToast shareId={mobileClipToast} onClose={() => setMobileClipToast(null)} />
      )}
    </div>
  );
}
