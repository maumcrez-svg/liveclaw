import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Inject, Optional, forwardRef, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../../common/redis.provider';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Server, Socket } from 'socket.io';
import { createHash } from 'crypto';
import { ChatService } from './chat.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { EmotesService } from '../emotes/emotes.service';
import { ModerationService } from './moderation/moderation.service';
import { AgentEntity } from '../agents/agent.entity';
import { StreamEntity } from '../streams/stream.entity';

/** Maximum messages a user may send in the rate-limit window. */
const RATE_LIMIT_MAX_MESSAGES = 5;
/** Window length in milliseconds for the rate limit. */
const RATE_LIMIT_WINDOW_MS = 10_000;

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
      : ['http://localhost:3000'],
    credentials: true,
  },
  // Lenient ping so background tabs aren't killed instantly.
  // Default pingTimeout is 20s — far too aggressive for background tabs
  // where browsers throttle JS and Socket.IO pong can't fire in time.
  pingInterval: 30_000,  // 30s between pings
  pingTimeout: 120_000,  // 2 minutes to respond — survives browser throttling
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(ChatGateway.name);

  @WebSocketServer()
  server: Server;

  private clientStreams: Map<string, string> = new Map();

  /** Cache streamId → agentId to avoid repeated DB lookups */
  private streamAgentMap: Map<string, string> = new Map();

  /** Track which Redis channels we've already subscribed to (dedup) */
  private subscribedChannels: Set<string> = new Set();

  /** Track last heartbeat response time per client */
  private clientLastSeen: Map<string, number> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly chatService: ChatService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectRepository(AgentEntity)
    private readonly agentRepo: Repository<AgentEntity>,
    @Optional() @Inject(forwardRef(() => SubscriptionsService))
    private readonly subscriptionsService: SubscriptionsService,
    @Optional() @Inject(forwardRef(() => EmotesService))
    private readonly emotesService: EmotesService,
    @Optional() @Inject(forwardRef(() => ModerationService))
    private readonly moderationService: ModerationService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {
    // Clear stale viewer sets from previous deploy — Redis persists but
    // in-memory socket tracking doesn't, so old viewer IDs become ghosts
    this.chatService.clearAllViewers().catch(() => {});

    // Heartbeat: every 60s, evict viewers whose sockets are dead but weren't cleaned up
    this.heartbeatInterval = setInterval(() => this.evictStaleViewers(), 60_000);
  }

  // FIX Bug #16: eviction now broadcasts count changes
  private async evictStaleViewers(): Promise<void> {
    const now = Date.now();
    const staleThreshold = 300_000; // 5 minutes
    let evicted = 0;
    const evictedIds: string[] = [];
    const affectedStreams: Map<string, number> = new Map();

    for (const [clientId, streamId] of this.clientStreams.entries()) {
      const lastSeen = this.clientLastSeen.get(clientId) ?? 0;
      if (lastSeen > 0 && now - lastSeen > staleThreshold) {
        const count = await this.chatService.removeViewer(streamId, clientId);
        this.clientStreams.delete(clientId);
        this.clientLastSeen.delete(clientId);
        evictedIds.push(clientId);
        affectedStreams.set(streamId, count);
        evicted++;
      }
    }

    // Broadcast updated counts for all affected streams
    for (const [streamId, count] of affectedStreams.entries()) {
      this.server.to(streamId).emit('viewer_count', { streamId, count });
      const agentId = await this.resolveAgentId(streamId);
      if (agentId) this.broadcastViewerUpdate(streamId, agentId, count);
    }

    if (evicted > 0) {
      this.logger.log(`Evicted ${evicted} stale viewer(s): ${evictedIds.join(', ')}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Connection lifecycle
  // ---------------------------------------------------------------------------

  async handleConnection(client: Socket) {
    const token =
      (client.handshake.auth as Record<string, string>)?.token ??
      (client.handshake.query?.token as string | undefined);

    if (!token) {
      client.data.anonymous = true;
      this.logger.log(`Anonymous client connected: ${client.id}`);
      return;
    }

    // Agent API key auth — SHA-256 lookup is sufficient for high-entropy tokens
    if (token.startsWith('lc_')) {
      try {
        const sha256 = createHash('sha256').update(token).digest('hex');
        const agent = await this.agentRepo.findOne({ where: { apiKeySha256: sha256 } });
        if (!agent) {
          client.disconnect();
          return;
        }
        client.data.userId = agent.id;
        client.data.username = agent.name;
        client.data.role = 'agent';
        client.data.agentId = agent.id;
        client.data.isAgent = true;
        this.logger.log(`Agent connected: ${client.id} (agent: ${agent.slug})`);
        return;
      } catch {
        client.disconnect();
        return;
      }
    }

    // JWT auth
    try {
      const payload = this.jwtService.verify<{
        sub: string;
        username: string;
        role: string;
      }>(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      client.data.userId = payload.sub;
      client.data.username = payload.username;
      client.data.role = payload.role;

      this.logger.log(
        `Client connected: ${client.id} (user: ${payload.username})`,
      );
    } catch {
      client.disconnect();
    }
  }

  // FIX Bug #3, #8: resolveAgentId always logs errors and has robust fallback
  async handleDisconnect(client: Socket) {
    const streamId = this.clientStreams.get(client.id);
    if (streamId) {
      client.leave(streamId);
      const count = await this.chatService.removeViewer(streamId, client.id);
      this.logger.log(`[DISCONNECT] socket=${client.id} stream=${streamId} remaining=${count}`);
      this.server.to(streamId).emit('viewer_count', { streamId, count });
      this.clientStreams.delete(client.id);
      this.clientLastSeen.delete(client.id);

      const agentId = await this.resolveAgentId(streamId);
      if (agentId) this.broadcastViewerUpdate(streamId, agentId, count);
    }
  }

  // ---------------------------------------------------------------------------
  // Global viewer counts — any client can subscribe to get real-time updates
  // ---------------------------------------------------------------------------

  // FIX Bug #1: populate streamAgentMap for ALL live streams (not just count>0)
  // so that subsequent broadcastViewerUpdate calls always resolve
  @SubscribeMessage('subscribe_counts')
  async handleSubscribeCounts(@ConnectedSocket() client: Socket) {
    client.join('counts');

    try {
      const streamRepo = this.agentRepo.manager.getRepository(StreamEntity);
      const liveStreams = await streamRepo.find({
        where: { isLive: true },
        select: ['id', 'agentId'],
      });

      // Always populate streamAgentMap for ALL live streams (FIX Bug #4, #7)
      for (const s of liveStreams) {
        this.streamAgentMap.set(s.id, s.agentId);
      }

      if (liveStreams.length > 0) {
        const countMap = await this.chatService.getViewerCountsBatch(
          liveStreams.map(s => s.id),
        );
        const entries: Array<{ agentId: string; count: number }> = [];
        for (const s of liveStreams) {
          const count = countMap.get(s.id) ?? 0;
          // Include ALL live streams in snapshot, even with 0 viewers (FIX Bug #7)
          entries.push({ agentId: s.agentId, count });
        }
        client.emit('viewer_count_snapshot', entries);
      }
    } catch (err) {
      this.logger.warn('Failed to send viewer count snapshot', err);
    }

    return { subscribed: true };
  }

  /** Broadcast a viewer count update to the global counts room */
  private broadcastViewerUpdate(streamId: string, agentId: string, count: number) {
    this.server.to('counts').emit('viewer_count_update', { streamId, agentId, count });
  }

  // FIX Bug #3: resolveAgentId now logs errors instead of swallowing them
  private async resolveAgentId(streamId: string): Promise<string | null> {
    const cached = this.streamAgentMap.get(streamId);
    if (cached) return cached;
    try {
      const stream = await this.agentRepo.manager
        .getRepository(StreamEntity)
        .findOne({ where: { id: streamId }, select: ['id', 'agentId'] });
      if (stream) {
        this.streamAgentMap.set(streamId, stream.agentId);
        return stream.agentId;
      }
      this.logger.warn(`[resolveAgentId] No stream found for id=${streamId}`);
    } catch (err) {
      this.logger.error(`[resolveAgentId] DB error for stream=${streamId}: ${err.message}`);
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // Stream join / leave
  // ---------------------------------------------------------------------------

  @SubscribeMessage('join_stream')
  async handleJoinStream(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { streamId: string },
  ) {
    const prevStream = this.clientStreams.get(client.id);

    // Idempotent: same socket re-joining same stream — refresh lastSeen + broadcast current count
    // FIX Bug #13: always broadcast on re-join so listeners get fresh data
    if (prevStream === data.streamId) {
      this.clientLastSeen.set(client.id, Date.now());
      const count = await this.chatService.getViewerCount(data.streamId);
      this.server.to(data.streamId).emit('viewer_count', { streamId: data.streamId, count });
      return { streamId: data.streamId, viewerCount: count };
    }

    if (prevStream) {
      client.leave(prevStream);
      const prevCount = await this.chatService.removeViewer(prevStream, client.id);
      const prevAgentId = await this.resolveAgentId(prevStream);
      if (prevAgentId) this.broadcastViewerUpdate(prevStream, prevAgentId, prevCount);
    }

    client.join(data.streamId);
    this.clientStreams.set(client.id, data.streamId);
    this.clientLastSeen.set(client.id, Date.now());
    const count = await this.chatService.addViewer(data.streamId, client.id);
    this.logger.log(
      `[JOIN] stream=${data.streamId} socket=${client.id} ` +
      `anon=${!!client.data.anonymous} user=${client.data.username ?? 'none'} ` +
      `prevStream=${prevStream ?? 'none'} countAfter=${count}`,
    );

    // Broadcast to stream room AND global counts room
    this.server
      .to(data.streamId)
      .emit('viewer_count', { streamId: data.streamId, count });

    const agentId = await this.resolveAgentId(data.streamId);
    if (agentId) this.broadcastViewerUpdate(data.streamId, agentId, count);

    // FIX Bug #9: deduplicate Redis subscriptions — only subscribe once per channel
    await this.ensureRedisSubscription(data.streamId);

    return { streamId: data.streamId, viewerCount: count };
  }

  /**
   * Join a stream room for chat messages only — no viewer counting.
   */
  @SubscribeMessage('join_chat')
  async handleJoinChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { streamId: string },
  ) {
    client.join(data.streamId);
    this.logger.log(`Chat-only join for stream ${data.streamId} (client: ${client.id})`);

    // FIX Bug #9: deduplicate Redis subscriptions
    await this.ensureRedisSubscription(data.streamId);

    return { streamId: data.streamId };
  }

  // FIX Bug #9: centralized Redis subscription with deduplication
  private async ensureRedisSubscription(streamId: string): Promise<void> {
    const chatChannel = `chat:${streamId}`;
    const alertChannel = `alerts:${streamId}`;

    if (!this.subscribedChannels.has(chatChannel)) {
      this.subscribedChannels.add(chatChannel);
      await this.chatService.subscribe(streamId, (message) => {
        this.server.to(streamId).emit('new_message', JSON.parse(message));
      });
    }

    if (!this.subscribedChannels.has(alertChannel)) {
      this.subscribedChannels.add(alertChannel);
      await this.chatService.subscribeAlerts(streamId, (alertJson) => {
        this.server.to(streamId).emit('stream_alert', JSON.parse(alertJson));
      });
    }
  }

  @SubscribeMessage('viewer_heartbeat')
  handleViewerHeartbeat(@ConnectedSocket() client: Socket) {
    this.clientLastSeen.set(client.id, Date.now());
  }

  @SubscribeMessage('leave_stream')
  async handleLeaveStream(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { streamId: string },
  ) {
    client.leave(data.streamId);
    this.clientStreams.delete(client.id);
    const count = await this.chatService.removeViewer(data.streamId, client.id);
    this.logger.log(`[LEAVE] stream=${data.streamId} socket=${client.id} remaining=${count}`);
    this.server
      .to(data.streamId)
      .emit('viewer_count', { streamId: data.streamId, count });

    const agentId = await this.resolveAgentId(data.streamId);
    if (agentId) this.broadcastViewerUpdate(data.streamId, agentId, count);
  }

  // ---------------------------------------------------------------------------
  // Alert-only subscription (no viewer count impact)
  // ---------------------------------------------------------------------------

  @SubscribeMessage('subscribe_alerts')
  async handleSubscribeAlerts(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { streamId: string },
  ) {
    client.join(data.streamId);
    await this.ensureRedisSubscription(data.streamId);
    return { streamId: data.streamId };
  }

  @SubscribeMessage('unsubscribe_alerts')
  async handleUnsubscribeAlerts(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { streamId: string },
  ) {
    client.leave(data.streamId);
  }

  // ---------------------------------------------------------------------------
  // Send message
  // ---------------------------------------------------------------------------

  @SubscribeMessage('send_message')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: { streamId: string; content: string; agentId?: string },
  ) {
    // Anonymous viewers can watch but not chat
    if (client.data.anonymous || !client.data.userId) {
      client.emit('error', { message: 'Authentication required to send messages' });
      return;
    }

    // Identity comes exclusively from the verified JWT stored in socket.data —
    // never trust client-supplied username / userId fields.
    const userId: string = client.data.userId as string;
    const username: string = client.data.username as string;

    // Validate message content
    if (!data.content || typeof data.content !== 'string' || data.content.trim().length === 0 || data.content.length > 500) {
      client.emit('error', { message: 'Message must be 1-500 characters' });
      return;
    }

    // ------------------------------------------------------------------
    // 1. Ban / timeout check
    // ------------------------------------------------------------------
    if (this.moderationService && data.agentId) {
      const banned = await this.moderationService.isUserBanned(
        data.agentId,
        userId,
      );
      if (banned) {
        client.emit('user_banned', {
          message: 'You are banned from this chat.',
        });
        return;
      }
    }

    // ------------------------------------------------------------------
    // 2. Slow mode check
    // ------------------------------------------------------------------
    if (this.moderationService && data.agentId) {
      const slowSeconds = await this.moderationService.getSlowMode(
        data.agentId,
      );
      if (slowSeconds > 0) {
        const lastMsgKey = `lastmsg:${data.agentId}:${userId}`;
        const lastMsgRaw = await this.chatService.getRedisKey(lastMsgKey);
        const now = Date.now();

        if (lastMsgRaw !== null) {
          const elapsed = (now - parseInt(lastMsgRaw, 10)) / 1000;
          if (elapsed < slowSeconds) {
            const waitSeconds = Math.ceil(slowSeconds - elapsed);
            client.emit('slow_mode_wait', { waitSeconds });
            return;
          }
        }

        await this.chatService.setRedisKey(
          lastMsgKey,
          String(now),
          slowSeconds + 5,
        );
      }
    }

    // ------------------------------------------------------------------
    // 3. Redis-based rate limiting (RATE_LIMIT_MAX_MESSAGES per RATE_LIMIT_WINDOW_MS)
    // ------------------------------------------------------------------
    const rateLimitKey = `rate:${data.agentId ?? 'global'}:${userId}`;
    const now = Date.now();
    const windowStart = now - RATE_LIMIT_WINDOW_MS;
    const msgId = `${now}:${Math.random().toString(36).slice(2, 6)}`;

    const pipeline = this.redis.pipeline();
    pipeline.zremrangebyscore(rateLimitKey, 0, windowStart);
    pipeline.zadd(rateLimitKey, now, msgId);
    pipeline.zcard(rateLimitKey);
    pipeline.expire(rateLimitKey, Math.ceil(RATE_LIMIT_WINDOW_MS / 1000) + 1);
    const results = await pipeline.exec();

    const count = results?.[2]?.[1] as number;
    if (count > RATE_LIMIT_MAX_MESSAGES) {
      client.emit('rate_limited', {
        message: `Too many messages. Max ${RATE_LIMIT_MAX_MESSAGES} per ${RATE_LIMIT_WINDOW_MS / 1000}s.`,
      });
      return;
    }

    // ------------------------------------------------------------------
    // 4. Optional enhancements: subscription badge + emote resolution
    // ------------------------------------------------------------------
    let badge: string | null = null;
    if (data.agentId && this.subscriptionsService) {
      badge = await this.subscriptionsService.getSubscriberTier(
        userId,
        data.agentId,
      );
    }

    let emotes: Array<{ name: string; imageUrl: string }> = [];
    if (data.agentId && this.emotesService) {
      emotes = await this.emotesService.resolveEmotes(
        data.content,
        data.agentId,
        userId,
      );
    }

    // ------------------------------------------------------------------
    // 5. Build and publish the message
    // ------------------------------------------------------------------
    const message: Record<string, unknown> = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      streamId: data.streamId,
      userId,
      username,
      content: data.content,
      type: 'user',
      createdAt: new Date().toISOString(),
    };

    if (badge) message.badge = badge;
    if (emotes.length > 0) message.emotes = emotes;

    await this.chatService.publishMessage(data.streamId, message);
  }
}
