import { Injectable, Logger, NotFoundException, Inject, Optional, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StreamEntity } from './stream.entity';
import { AgentsService } from '../agents/agents.service';
import { ChatService } from '../chat/chat.service';

@Injectable()
export class StreamsService {
  private readonly logger = new Logger(StreamsService.name);

  constructor(
    @InjectRepository(StreamEntity)
    private readonly streamRepo: Repository<StreamEntity>,
    private readonly agentsService: AgentsService,
    @Optional() @Inject(forwardRef(() => ChatService))
    private readonly chatService: ChatService,
  ) {}

  async findLive(opts?: { category?: string; sort?: string }): Promise<StreamEntity[]> {
    const qb = this.streamRepo
      .createQueryBuilder('stream')
      .leftJoin('stream.agent', 'agent')
      .leftJoin('stream.category', 'category')
      .addSelect([
        'stream.id', 'stream.agentId', 'stream.title', 'stream.startedAt',
        'stream.currentViewers', 'stream.peakViewers', 'stream.isLive',
        'stream.tags', 'stream.categoryId', 'stream.thumbnailUrl',
        'agent.id', 'agent.slug', 'agent.name', 'agent.avatarUrl',
        'agent.bannerUrl', 'agent.status', 'agent.streamKey',
        'agent.followerCount', 'agent.subscriberCount', 'agent.defaultTags',
        'category.id', 'category.name', 'category.slug', 'category.imageUrl',
      ])
      .where('stream.isLive = :isLive', { isLive: true });

    if (opts?.category) {
      qb.andWhere('category.slug = :slug', { slug: opts.category });
    }

    if (opts?.sort === 'viewers') {
      qb.orderBy('stream.currentViewers', 'DESC');
    } else {
      qb.orderBy('stream.startedAt', 'DESC');
    }

    return qb.getMany();
  }

  async findByAgent(agentId: string): Promise<StreamEntity[]> {
    return this.streamRepo.find({
      where: { agentId },
      relations: ['category'],
      order: { startedAt: 'DESC' },
    });
  }

  async getCurrentStream(agentId: string): Promise<StreamEntity | null> {
    return this.streamRepo.findOne({
      where: { agentId, isLive: true },
      relations: ['agent'],
    });
  }

  async startStream(agentId: string, title?: string): Promise<StreamEntity> {
    const agent = await this.agentsService.findById(agentId);
    const stream = this.streamRepo.create({
      agentId,
      title: title || agent?.name || 'Untitled Stream',
      categoryId: agent?.defaultCategoryId ?? null,
      tags: agent?.defaultTags ?? [],
      isLive: true,
    });
    await this.agentsService.updateStatus(agentId, 'live');
    return this.streamRepo.save(stream);
  }

  async endStream(agentId: string): Promise<StreamEntity | null> {
    const stream = await this.getCurrentStream(agentId);
    if (!stream) return null;
    stream.isLive = false;
    stream.currentViewers = 0;
    stream.endedAt = new Date();
    await this.agentsService.updateStatus(agentId, 'offline');
    if (this.chatService) {
      await this.chatService.clearViewers(stream.id);
    }
    return this.streamRepo.save(stream);
  }

  async updateMetadata(
    streamId: string,
    agentId: string,
    dto: { title?: string; categoryId?: string; tags?: string[] },
  ): Promise<StreamEntity> {
    const stream = await this.streamRepo.findOne({
      where: { id: streamId, agentId, isLive: true },
    });
    if (!stream) {
      throw new NotFoundException('No live stream found');
    }
    Object.assign(stream, dto);
    return this.streamRepo.save(stream);
  }

  async handleMediaMTXEvent(
    event: 'publish' | 'unpublish',
    streamKey: string,
  ): Promise<void> {
    const agent = await this.agentsService.findByStreamKey(streamKey);
    if (!agent) {
      this.logger.warn(
        `[UNKNOWN KEY] Publish event for unknown stream key "${streamKey.slice(0, 8)}..." — no matching agent`,
      );
      return;
    }

    if (event === 'publish') {
      // One active source per channel: reject if already live
      if (agent.status === 'live') {
        this.logger.warn(
          `[CONFLICT] Publish event for agent "${agent.slug}" but already live — ignoring duplicate`,
        );
        return;
      }

      // Native mode: only accept publish from our own container.
      // If publish arrives but no containerId exists, this is an unauthorized
      // external source — refuse to promote to live.
      // The RTMP data still flows through MediaMTX (we can't stop it at webhook level),
      // but the platform does not recognize the stream: no live status, no stream record,
      // no visibility on the site. Reconciliation will log it as a ghost path.
      if (agent.streamingMode === 'native' && !agent.containerId) {
        this.logger.warn(
          `[REJECTED] Agent "${agent.slug}" is native but received external publish (no container) — refusing to promote to live`,
        );
        return;
      }

      await this.startStream(agent.id, agent.name);
    } else {
      await this.endStream(agent.id);
    }
  }
}
