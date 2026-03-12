import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Inject, Optional, forwardRef } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { EmotesService } from '../emotes/emotes.service';
import { ModerationService } from './moderation/moderation.service';

/** Maximum messages a user may send in the rate-limit window. */
const RATE_LIMIT_MAX_MESSAGES = 5;
/** Window length in milliseconds for the in-memory rate limit. */
const RATE_LIMIT_WINDOW_MS = 10_000;

interface RateLimitEntry {
  timestamps: number[];
}

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
      : ['http://localhost:3000'],
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private clientStreams: Map<string, string> = new Map();

  /** In-memory rate limit tracker. Key: `{agentId}:{userId}` */
  private rateLimitMap: Map<string, RateLimitEntry> = new Map();

  constructor(
    private readonly chatService: ChatService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Optional() @Inject(forwardRef(() => SubscriptionsService))
    private readonly subscriptionsService: SubscriptionsService,
    @Optional() @Inject(forwardRef(() => EmotesService))
    private readonly emotesService: EmotesService,
    @Optional() @Inject(forwardRef(() => ModerationService))
    private readonly moderationService: ModerationService,
  ) {}

  // ---------------------------------------------------------------------------
  // Connection lifecycle
  // ---------------------------------------------------------------------------

  handleConnection(client: Socket) {
    const token =
      (client.handshake.auth as Record<string, string>)?.token ??
      (client.handshake.query?.token as string | undefined);

    if (!token) {
      client.disconnect();
      return;
    }

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

      console.log(
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
      this.server.to(streamId).emit('viewer_count', { streamId, count });
      this.clientStreams.delete(client.id);
    }
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
    if (prevStream) {
      client.leave(prevStream);
      await this.chatService.removeViewer(prevStream, client.id);
    }

    client.join(data.streamId);
    this.clientStreams.set(client.id, data.streamId);
    const count = await this.chatService.addViewer(data.streamId, client.id);
    this.server
      .to(data.streamId)
      .emit('viewer_count', { streamId: data.streamId, count });

    await this.chatService.subscribe(data.streamId, (message) => {
      this.server.to(data.streamId).emit('new_message', JSON.parse(message));
    });

    return {
      event: 'joined',
      data: { streamId: data.streamId, viewerCount: count },
    };
  }

  @SubscribeMessage('leave_stream')
  async handleLeaveStream(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { streamId: string },
  ) {
    client.leave(data.streamId);
    this.clientStreams.delete(client.id);
    const count = await this.chatService.removeViewer(data.streamId, client.id);
    this.server
      .to(data.streamId)
      .emit('viewer_count', { streamId: data.streamId, count });
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
    // Identity comes exclusively from the verified JWT stored in socket.data —
    // never trust client-supplied username / userId fields.
    const userId: string = client.data.userId as string;
    const username: string = client.data.username as string;

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
    // 3. In-memory rate limiting (RATE_LIMIT_MAX_MESSAGES per RATE_LIMIT_WINDOW_MS)
    // ------------------------------------------------------------------
    const rateLimitKey = `${data.agentId ?? 'global'}:${userId}`;
    const entry = this.rateLimitMap.get(rateLimitKey) ?? { timestamps: [] };
    const windowStart = Date.now() - RATE_LIMIT_WINDOW_MS;

    // Evict timestamps outside the current window
    entry.timestamps = entry.timestamps.filter((ts) => ts > windowStart);

    if (entry.timestamps.length >= RATE_LIMIT_MAX_MESSAGES) {
      client.emit('rate_limited', {
        message: `Too many messages. Max ${RATE_LIMIT_MAX_MESSAGES} per ${
          RATE_LIMIT_WINDOW_MS / 1000
        }s.`,
      });
      this.rateLimitMap.set(rateLimitKey, entry);
      return;
    }

    entry.timestamps.push(Date.now());
    this.rateLimitMap.set(rateLimitKey, entry);

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
