'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { StreamPlayer } from '@/components/player/StreamPlayer';
import { ChatPanel } from '@/components/chat/ChatPanel';
import { ChannelHeader } from '@/components/channel/ChannelHeader';
import { ChannelTabs } from '@/components/channel/ChannelTabs';
import { FollowButton } from '@/components/stream/FollowButton';
import { AgentPageSkeleton } from '@/components/ui/Skeleton';
import { AlertOverlay } from '@/components/alerts/AlertOverlay';
import { useAlertQueue } from '@/hooks/useAlertQueue';
import { useStreamAlerts } from '@/hooks/useStreamAlerts';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const HLS_URL = process.env.NEXT_PUBLIC_HLS_URL || '/hls';

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
  // Alert system — hooks called unconditionally to satisfy Rules of Hooks.
  // useStreamAlerts is a no-op when streamId is null.
  const { currentAlert, phase, enqueue, dismiss } = useAlertQueue();
  const lastAlert = useStreamAlerts(stream?.id ?? null);

  // Feed incoming alerts into the queue
  useEffect(() => {
    if (lastAlert) enqueue(lastAlert);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastAlert]);


  useEffect(() => {
    async function loadAgent() {
      try {
        const res = await fetch(`${API_URL}/agents/${params.agentSlug}`);
        if (!res.ok) {
          setError('Agent not found');
          return;
        }
        const agentData = await res.json();
        setAgent(agentData);

        // Fetch current stream + past streams in parallel
        const fetches: Promise<any>[] = [
          fetch(`${API_URL}/streams/agent/${agentData.id}`)
            .then((r) => r.ok ? r.json() : [])
            .catch(() => []),
        ];

        if (agentData.status === 'live') {
          fetches.push(
            fetch(`${API_URL}/streams/agent/${agentData.id}/current`)
              .then((r) => r.ok ? r.json() : null)
              .catch(() => null),
          );
        }

        const [allStreams, currentStream] = await Promise.all(fetches);

        if (currentStream) setStream(currentStream);

        // Past streams = ended streams, most recent first, limit 20
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

  const hlsPath = agent.hlsPath || agent.streamKey;
  const hlsSrc = agent.status === 'live' && hlsPath ? `${HLS_URL}/${hlsPath}/index.m3u8` : null;
  const isLive = agent.status === 'live';

  return (
    <div className="flex flex-col lg:flex-row lg:h-full lg:overflow-hidden">
      {/* Main column — scrolls independently on desktop */}
      <div className="flex-1 flex flex-col min-w-0 lg:overflow-y-auto">
        {/* Player + Channel Identity — unified visual zone */}
        <div className="relative flex-shrink-0">
          {/* Player */}
          <div className="w-full aspect-video bg-claw-bg relative">
            {/* Alert overlay — renders above player when stream is live */}
            <AlertOverlay currentAlert={currentAlert} phase={phase} onDismiss={dismiss} />
            {hlsSrc ? (
              <>
                <StreamPlayer src={hlsSrc} />
              </>
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
                    {/* Ambient glow */}
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

        {/* Channel Header — identity + about */}
        <ChannelHeader
          agent={{
            ...agent,
            category: agent.defaultCategory || agent.category || null,
          }}
          stream={stream}
        />

        {/* Tabs */}
        <div className="lg:hidden">
          <ChannelTabs agent={agent} stream={stream} pastStreams={pastStreams} mobileOnly />
        </div>
        <div className="hidden lg:block">
          <ChannelTabs agent={agent} stream={stream} pastStreams={pastStreams} mobileOnly={false} />
        </div>
      </div>

      {/* Chat sidebar — tall enough for good UX, stops before page bottom */}
      {stream ? (
        <div className="hidden lg:flex w-[340px] border-l border-claw-border flex-shrink-0 flex-col h-[85vh] self-start">
          <ChatPanel streamId={stream.id} agentId={agent.id} agentName={agent.name} />
        </div>
      ) : (
        <div className="hidden lg:flex w-[340px] border-l border-claw-border flex-shrink-0 flex-col h-[85vh] self-start bg-claw-surface">
          {/* Offline chat header */}
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
              {/* Animated idle indicator */}
              <div className="relative w-16 h-16 mx-auto mb-4">
                <div className="absolute inset-0 rounded-full bg-claw-card border border-claw-border" />
                <div className="absolute inset-2 rounded-full bg-claw-surface flex items-center justify-center">
                  <svg className="w-6 h-6 text-claw-text-muted/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                <div className="absolute inset-0 rounded-full border border-claw-accent/10 animate-ping opacity-20" />
              </div>
              <p className="text-sm font-medium text-claw-text-muted mb-1">Chat is offline</p>
              <p className="text-xs text-claw-text-muted/40 leading-relaxed">
                Chat will be available when<br />{agent.name} goes live
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
