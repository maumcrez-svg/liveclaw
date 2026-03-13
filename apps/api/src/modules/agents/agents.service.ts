import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgentEntity } from './agent.entity';
import { CreateAgentDto, UpdateAgentDto, HeartbeatDto } from './agents.dto';
import { v4 as uuidv4 } from 'uuid';
import { randomBytes, createHash } from 'crypto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AgentsService {
  constructor(
    @InjectRepository(AgentEntity)
    private readonly agentRepo: Repository<AgentEntity>,
  ) {}

  async findAll(): Promise<any[]> {
    const agents = await this.agentRepo.find({
      relations: ['defaultCategory'],
      order: { createdAt: 'DESC' },
    });
    // Attach currentViewers from active stream
    const liveAgentIds = agents.filter(a => a.status === 'live').map(a => a.id);
    if (liveAgentIds.length === 0) return agents;

    const streams = await this.agentRepo.manager
      .createQueryBuilder()
      .select(['agent_id', 'current_viewers'])
      .from('streams', 's')
      .where('s.is_live = true AND s.agent_id IN (:...ids)', { ids: liveAgentIds })
      .getRawMany();
    const viewerMap = new Map(streams.map((s: any) => [s.agent_id, s.current_viewers]));

    return agents.map(a => ({
      ...a,
      currentViewers: viewerMap.get(a.id) ?? 0,
    }));
  }

  async findLive(): Promise<AgentEntity[]> {
    return this.agentRepo.find({
      where: { status: 'live' },
      relations: ['streams'],
      order: { followerCount: 'DESC' },
    });
  }

  async findBySlug(slug: string): Promise<AgentEntity> {
    const agent = await this.agentRepo.findOne({
      where: { slug },
      relations: ['streams', 'defaultCategory'],
    });
    if (!agent) throw new NotFoundException(`Agent ${slug} not found`);
    return agent;
  }

  async findById(id: string): Promise<AgentEntity> {
    const agent = await this.agentRepo.findOne({ where: { id } });
    if (!agent) throw new NotFoundException(`Agent ${id} not found`);
    return agent;
  }

  async findByStreamKey(streamKey: string): Promise<AgentEntity | null> {
    return this.agentRepo.findOne({ where: { streamKey } });
  }

  async findByCategory(categorySlug: string): Promise<AgentEntity[]> {
    return this.agentRepo.find({
      where: { defaultCategory: { slug: categorySlug } },
      relations: ['defaultCategory'],
      order: { createdAt: 'DESC' },
    });
  }

  async findByOwner(ownerId: string): Promise<AgentEntity[]> {
    return this.agentRepo.find({
      where: { ownerId },
      order: { createdAt: 'DESC' },
    });
  }

  async create(dto: CreateAgentDto): Promise<AgentEntity> {
    const existing = await this.agentRepo.findOne({ where: { slug: dto.slug } });
    if (existing) {
      throw new BadRequestException(`An agent with slug "${dto.slug}" already exists.`);
    }
    const agent = this.agentRepo.create({
      ...dto,
      streamKey: uuidv4().replace(/-/g, ''),
    });
    return this.agentRepo.save(agent);
  }

  async update(id: string, dto: UpdateAgentDto): Promise<AgentEntity> {
    const agent = await this.findById(id);

    if (
      dto.streamingMode &&
      dto.streamingMode !== agent.streamingMode &&
      agent.status !== 'offline'
    ) {
      throw new BadRequestException(
        'Cannot change streaming mode while the agent is live. Stop the stream first.',
      );
    }

    Object.assign(agent, dto);
    return this.agentRepo.save(agent);
  }

  async updateStatus(
    id: string,
    status: string,
    containerId?: string | null,
  ): Promise<AgentEntity> {
    const agent = await this.findById(id);
    agent.status = status;
    if (containerId !== undefined) agent.containerId = containerId;
    return this.agentRepo.save(agent);
  }

  async rotateStreamKey(agentId: string): Promise<AgentEntity> {
    const agent = await this.findById(agentId);

    if (agent.status !== 'offline') {
      throw new BadRequestException(
        'Cannot rotate stream key while the agent is live. Stop the stream first.',
      );
    }

    agent.streamKey = uuidv4().replace(/-/g, '');
    return this.agentRepo.save(agent);
  }

  async search(query: string): Promise<AgentEntity[]> {
    return this.agentRepo
      .createQueryBuilder('agent')
      .where('agent.name ILIKE :q OR agent.description ILIKE :q', {
        q: `%${query}%`,
      })
      .orderBy('agent.status', 'ASC') // live first
      .addOrderBy('agent.followerCount', 'DESC')
      .limit(20)
      .getMany();
  }

  async rotateApiKey(agentId: string): Promise<{ apiKey: string }> {
    const agent = await this.findById(agentId);
    const plaintext = 'lc_' + randomBytes(16).toString('hex');
    agent.apiKeyHash = await bcrypt.hash(plaintext, 12);
    agent.apiKeySha256 = createHash('sha256').update(plaintext).digest('hex');
    await this.agentRepo.save(agent);
    return { apiKey: plaintext };
  }

  async heartbeat(agentId: string, dto: HeartbeatDto): Promise<{ ok: true; lastHeartbeatAt: Date }> {
    const agent = await this.findById(agentId);
    agent.lastHeartbeatAt = new Date();
    if (dto.status) {
      agent.status = dto.status;
    }
    await this.agentRepo.save(agent);
    return { ok: true, lastHeartbeatAt: agent.lastHeartbeatAt };
  }

  async findByApiKeySha256(sha256: string): Promise<AgentEntity | null> {
    return this.agentRepo.findOne({ where: { apiKeySha256: sha256 } });
  }

  async delete(id: string): Promise<void> {
    await this.agentRepo.delete(id);
  }
}
