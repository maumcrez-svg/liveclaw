import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { ClipEntity } from './clip.entity';
import { AgentEntity } from '../agents/agent.entity';
import { StreamEntity } from '../streams/stream.entity';
import { CreateClipDto } from './clips.dto';
import { ClipProcessorService } from './clip-processor.service';

@Injectable()
export class ClipsService {
  private readonly logger = new Logger(ClipsService.name);

  constructor(
    @InjectRepository(ClipEntity)
    private readonly clipRepo: Repository<ClipEntity>,
    @InjectRepository(AgentEntity)
    private readonly agentRepo: Repository<AgentEntity>,
    @InjectRepository(StreamEntity)
    private readonly streamRepo: Repository<StreamEntity>,
    private readonly processor: ClipProcessorService,
  ) {}

  private generateShareId(): string {
    return randomBytes(9).toString('base64url').slice(0, 12);
  }

  async create(dto: CreateClipDto, userId: string): Promise<ClipEntity> {
    const agent = await this.agentRepo.findOne({ where: { id: dto.agentId } });
    if (!agent) throw new NotFoundException('Agent not found');
    if (agent.status !== 'live') {
      throw new BadRequestException('Agent is not live — cannot create clip');
    }

    let streamId = dto.streamId || null;
    if (!streamId) {
      const current = await this.streamRepo.findOne({
        where: { agentId: dto.agentId, isLive: true },
        order: { startedAt: 'DESC' },
      });
      if (current) streamId = current.id;
    }

    const shareId = this.generateShareId();

    const clip = this.clipRepo.create({
      shareId,
      agentId: dto.agentId,
      streamId,
      creatorUserId: userId,
      title: dto.title.trim(),
      durationSeconds: dto.duration,
      status: 'pending',
    });

    const saved = await this.clipRepo.save(clip);

    // Fire-and-forget processing
    this.processor.enqueue(saved.id, agent.streamKey, dto.duration, shareId);

    this.logger.log(
      `Clip ${shareId} queued for agent ${agent.slug} (${dto.duration}s)`,
    );

    return saved;
  }

  async findByShareId(shareId: string): Promise<ClipEntity> {
    const clip = await this.clipRepo.findOne({
      where: { shareId },
      relations: ['agent', 'creator'],
    });
    if (!clip) throw new NotFoundException('Clip not found');
    return clip;
  }

  async findByShareIdAndIncrementViews(shareId: string): Promise<ClipEntity> {
    const clip = await this.findByShareId(shareId);
    if (clip.status === 'ready') {
      await this.clipRepo.increment({ id: clip.id }, 'viewCount', 1);
      clip.viewCount += 1;
    }
    return clip;
  }

  async findByAgent(
    agentId: string,
    limit = 20,
    offset = 0,
  ): Promise<{ data: ClipEntity[]; total: number }> {
    const [data, total] = await this.clipRepo.findAndCount({
      where: { agentId, status: 'ready' },
      relations: ['creator'],
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
    return { data, total };
  }

  async findByUser(
    userId: string,
    limit = 20,
    offset = 0,
  ): Promise<{ data: ClipEntity[]; total: number }> {
    const [data, total] = await this.clipRepo.findAndCount({
      where: { creatorUserId: userId },
      relations: ['agent'],
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
    return { data, total };
  }

  async getStatus(
    shareId: string,
    userId: string,
  ): Promise<{ status: string; errorMessage: string | null }> {
    const clip = await this.clipRepo.findOne({ where: { shareId } });
    if (!clip) throw new NotFoundException('Clip not found');
    if (clip.creatorUserId !== userId) {
      throw new NotFoundException('Clip not found');
    }
    return { status: clip.status, errorMessage: clip.errorMessage };
  }

  async delete(id: string, userId: string, role: string): Promise<void> {
    const clip = await this.clipRepo.findOne({ where: { id } });
    if (!clip) throw new NotFoundException('Clip not found');
    if (role !== 'admin' && clip.creatorUserId !== userId) {
      throw new NotFoundException('Clip not found');
    }

    // Delete files
    this.processor.deleteFiles(clip.shareId);

    await this.clipRepo.remove(clip);
    this.logger.log(`Clip ${clip.shareId} deleted by user ${userId}`);
  }
}
