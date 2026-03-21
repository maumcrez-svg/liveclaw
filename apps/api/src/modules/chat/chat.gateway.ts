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
import * as bcrypt from 'bcrypt';
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
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(ChatGateway.name);

  @WebSocketServer()
  server: Server;

  private clientStreams: Map<string, string> = new Map();

  /** Cache streamId → agentId to avoid repeated DB lookups */
  private streamAgentMap: Map<string, string> = new Map();

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
    // Heartbeat: every 60s, evict viewers whose sockets are dead but weren't cleaned up
    this.heartbeatInterval = setInterval(() => this.evictStaleViewers(), 60_000);
  }

  private async evictStaleViewers(): Promise<void> {
    const now = Date.now();
    const staleThreshold = 90_000; // 90s without activity = stale
    let evicted = 0;
    const evictedIds: string[] = [];
    for (const [clientId, streamId] of this.clientStreams.entries()) {
      const lastSeen = this.clientLastSeen.get(clientId) ?? 0;
      // Check if socket is still connected in the server's socket map
      const socket = this.server?.sockets?.sockets?.get(clientId);
      if (!socket || !socket.connected) {
        // Double-check: if we just saw this client very recently, skip eviction.
        // This prevents race conditions where a socket reconnects right as eviction runs.
        if (lastSeen > 0 && now - lastSeen < 10_000) {
          this.logger.debug(`Skipping eviction of recently-seen viewer ${clientId} on stream ${streamId}`);
          continue;
        }
        // Socket is truly gone — evict
        await this.chatService.removeViewer(streamId, clientId);
        this.clientStreams.delete(clientId);
        this.clientLastSeen.delete(clientId);
        evictedIds.push(clientId);
        evicted++;
      } else if (now - lastSeen > staleThreshold && lastSeen > 0) {
        // Socket connected but no heartbeat response in 90s
        // Don't evict — just log. Socket.IO's own ping/pong handles truly dead connections.
        this.logger.debug(`Stale viewer ${clientId} on stream ${streamId} (${Math.round((now - lastSeen) / 1000)}s)`);
      }
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
      // Allow unauthenticated connections for viewer count subscriptions only.
      // They can subscribe_counts but cannot join_stream or send_message.
      client.data.anonymous = true;
      return;
    }

    // Agent API key auth
    if (token.startsWith('lc_')) {
      try {
        const sha256 = createHash('sha256').update(token).digest('hex');
        const agent = await this.agentRepo.findOne({ where: { apiKeySha256: sha256 } });
        if (!agent || !agent.apiKeyHash) {
          client.disconnect();
          return;
        }
        const valid = await bcrypt.compare(token, agent.apiKeyHash);
        if (!valid) {
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

  async handleDisconnect(client: Socket) {
    const streamId = this.clientStreams.get(client.id);
    if (streamId) {
      client.leave(streamId);
      const count = await this.chatService.removeViewer(streamId, client.id);
      this.logger.log(`Viewer disconnected from stream ${streamId} (client: ${client.id}, remaining: ${count})`);
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

  @SubscribeMessage('subscribe_counts')
  async handleSubscribeCounts(@ConnectedSocket() client: Socket) {
    client.join('counts');

    // Send snapshot of all current viewer counts so client starts with full picture
    try {
      const streamRepo = this.agentRepo.manager.getRepository(StreamEntity);
      const liveStreams = await streamRepo.find({
        where: { isLive: true },
        select: ['id', 'agentId'],
      });
      if (liveStreams.length > 0) {
        const entries: Array<{ agentId: string; count: number }> = [];
        for (const s of liveStreams) {
          const count = await this.chatService.getViewerCount(s.id);
          if (count > 0) {
            entries.push({ agentId: s.agentId, count });
            this.streamAgentMap.set(s.id, s.agentId);
          }
        }
        if (entries.length > 0) {
          client.emit('viewer_count_snapshot', entries);
        }
      }
    } catch (err) {
      this.logger.warn('Failed to send viewer count snapshot', err);
    }

    return { event: 'subscribed_counts' };
  }

  /** Broadcast a viewer count update to the global counts room */
  private broadcastViewerUpdate(streamId: string, agentId: string, count: number) {
    this.server.to('counts').emit('viewer_count_update', { streamId, agentId, count });
  }

  /** Resolve agentId from streamId, with cache */
  private async resolveAgentId(streamId: string): Promise<string | null> {
    const cached = this.streamAgentMap.get(streamId);
    if (cached) return cached;
    try {
      const stream = await this.agentRepo.manager
        .getRepository('StreamEntity')
        .findOne({ where: { id: streamId }, select: ['id', 'agentId'] });
      if (stream) {
        this.streamAgentMap.set(streamId, (stream as any).agentId);
        return (stream as any).agentId;
      }
    } catch {}
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
    // Allow anonymous viewers to join streams (they count as viewers but can't chat)
    const prevStream = this.clientStreams.get(client.id);
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
    this.logger.log(`Viewer joined stream ${data.streamId} (client: ${client.id}, count: ${count})`);
    this.server
      .to(data.streamId)
      .emit('viewer_count', { streamId: data.streamId, count });

    // Broadcast to global counts subscribers
    const agentId = await this.resolveAgentId(data.streamId);
    if (agentId) this.broadcastViewerUpdate(data.streamId, agentId, count);

    await this.chatService.subscribe(data.streamId, (message) => {
      this.server.to(data.streamId).emit('new_message', JSON.parse(message));
    });

    await this.chatService.subscribeAlerts(data.streamId, (alertJson) => {
      this.server.to(data.streamId).emit('stream_alert', JSON.parse(alertJson));
    });

    return {
      event: 'joined',
      data: { streamId: data.streamId, viewerCount: count },
    };
  }

  /**
   * Join a stream room for chat messages only — no viewer counting.
   * Used by the chat socket so it receives new_message broadcasts
   * without inflating the viewer count (presence is handled separately).
   */
  @SubscribeMessage('join_chat')
  async handleJoinChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { streamId: string },
  ) {
    client.join(data.streamId);
    this.logger.log(`Chat-only join for stream ${data.streamId} (client: ${client.id})`);

    // Subscribe to Redis pub/sub so messages flow to this room
    await this.chatService.subscribe(data.streamId, (message) => {
      this.server.to(data.streamId).emit('new_message', JSON.parse(message));
    });

    await this.chatService.subscribeAlerts(data.streamId, (alertJson) => {
      this.server.to(data.streamId).emit('stream_alert', JSON.parse(alertJson));
    });

    return { event: 'joined_chat', data: { streamId: data.streamId } };
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
    this.logger.log(`Viewer left stream ${data.streamId} (client: ${client.id}, remaining: ${count})`);
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

    await this.chatService.subscribeAlerts(data.streamId, (alertJson) => {
      this.server.to(data.streamId).emit('stream_alert', JSON.parse(alertJson));
    });

    return { event: 'subscribed_alerts', data: { streamId: data.streamId } };
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

        // Record current send time with a TTL so Redis does not accumulate
        // stale keys indefinitely.
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
