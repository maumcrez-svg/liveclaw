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

  async getConnectionInfo(id: string) {
    const agent = await this.findById(id);

    const rtmpUrl = process.env.MEDIAMTX_RTMP_URL || 'rtmp://localhost:1935';
    const hlsBaseUrl = process.env.MEDIAMTX_HLS_URL || 'http://localhost:8888';
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';
    const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';
    const watchHost = corsOrigin.split(',')[0].trim();

    const isOffline = agent.status === 'offline';
    const isLive = agent.status === 'live';

    const notes: string[] = [
      'Use Custom RTMP server in OBS.',
      'Rotate stream key only while offline.',
    ];

    if (agent.streamingMode === 'native') {
      notes.push('Native runtime is currently disabled — use external streaming mode.');
    }

    return {
      agentId: agent.id,
      agentName: agent.name,
      agentSlug: agent.slug,
      streamingMode: agent.streamingMode,
      status: agent.status,
      connection: {
        rtmpUrl,
        streamKey: agent.streamKey,
        fullRtmpUrl: `${rtmpUrl}/${agent.streamKey}`,
        hlsUrl: `${hlsBaseUrl}/${agent.streamKey}/index.m3u8`,
        watchUrl: `${watchHost}/${agent.slug}`,
      },
      sdk: {
        websocketUrl: wsUrl,
        apiBaseUrl,
        agentApiKeyConfigured: !!agent.apiKeySha256,
      },
      recommendedSettings: {
        videoCodec: 'H.264',
        audioCodec: 'AAC',
        resolution: '1920x1080',
        fps: 30,
        videoBitrateKbps: 4500,
        audioBitrateKbps: 160,
        keyframeIntervalSeconds: 2,
      },
      actions: {
        canStartRuntime: false,
        canStopRuntime: false,
        canRotateStreamKey: isOffline,
        canRotateApiKey: isOffline,
      },
      runtime: {
        logsUrl: `/runtime/${agent.id}/logs`,
        startUrl: `/runtime/${agent.id}/start`,
        stopUrl: `/runtime/${agent.id}/stop`,
      },
      health: {
        streamLive: isLive,
        lastSeenAt: agent.lastHeartbeatAt,
      },
      examples: {
        obs: {
          service: 'Custom',
          server: rtmpUrl,
          streamKey: agent.streamKey,
        },
        ffmpeg: `ffmpeg -re -i input.mp4 -c:v libx264 -c:a aac -f flv ${rtmpUrl}/${agent.streamKey}`,
      },
      notes,
    };
  }

  async findByApiKeySha256(sha256: string): Promise<AgentEntity | null> {
    return this.agentRepo.findOne({ where: { apiKeySha256: sha256 } });
  }

  async delete(id: string): Promise<void> {
    await this.agentRepo.delete(id);
  }
}
