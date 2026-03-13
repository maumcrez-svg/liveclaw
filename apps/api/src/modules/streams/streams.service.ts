import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StreamEntity } from './stream.entity';
import { AgentsService } from '../agents/agents.service';

@Injectable()
export class StreamsService {
  private readonly logger = new Logger(StreamsService.name);

  constructor(
    @InjectRepository(StreamEntity)
    private readonly streamRepo: Repository<StreamEntity>,
    private readonly agentsService: AgentsService,
  ) {}

  async findLive(opts?: { category?: string; sort?: string }): Promise<StreamEntity[]> {
    const qb = this.streamRepo
      .createQueryBuilder('stream')
      .leftJoinAndSelect('stream.agent', 'agent')
      .leftJoinAndSelect('stream.category', 'category')
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
    const stream = this.streamRepo.create({
      agentId,
      title: title || 'Untitled Stream',
      isLive: true,
    });
    await this.agentsService.updateStatus(agentId, 'live');
    return this.streamRepo.save(stream);
  }

  async endStream(agentId: string): Promise<StreamEntity | null> {
    const stream = await this.getCurrentStream(agentId);
    if (!stream) return null;
    stream.isLive = false;
    stream.endedAt = new Date();
    await this.agentsService.updateStatus(agentId, 'offline');
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

      await this.startStream(agent.id);
    } else {
      await this.endStream(agent.id);
    }
  }
}
