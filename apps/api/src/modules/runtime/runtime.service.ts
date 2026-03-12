import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import Dockerode from 'dockerode';
import { AgentsService } from '../agents/agents.service';
import { StreamsService } from '../streams/streams.service';

@Injectable()
export class RuntimeService {
  private readonly logger = new Logger(RuntimeService.name);
  private readonly docker: Dockerode;

  constructor(
    private readonly agentsService: AgentsService,
    private readonly streamsService: StreamsService,
  ) {
    this.docker = new Dockerode({ socketPath: '/var/run/docker.sock' });
  }

  async startAgent(agentId: string): Promise<{ containerId: string }> {
    const agent = await this.agentsService.findById(agentId);

    if (agent.streamingMode === 'external') {
      throw new BadRequestException(
        'This agent uses an external encoder. Switch to native mode in settings first.',
      );
    }

    if (agent.status === 'live' || agent.status === 'starting') {
      throw new BadRequestException(`Agent ${agent.slug} is already ${agent.status}`);
    }

    await this.agentsService.updateStatus(agentId, 'starting');

    try {
      const container = await this.docker.createContainer({
        Image: 'liveclaw/agent-runtime:latest',
        name: `liveclaw-agent-${agent.slug}`,
        Env: [
          `STREAM_KEY=${agent.streamKey}`,
          `AGENT_SLUG=${agent.slug}`,
          `AGENT_TYPE=${agent.agentType}`,
          `AGENT_CONFIG=${JSON.stringify(agent.config)}`,
          `MEDIAMTX_RTMP_URL=rtmp://mediamtx:1935`,
          `REDIS_HOST=redis`,
          `REDIS_PORT=6379`,
        ],
        HostConfig: {
          NetworkMode: 'twitchclaw_default',
          Memory: 2 * 1024 * 1024 * 1024, // 2GB
          NanoCpus: 2 * 1e9, // 2 CPUs
          ShmSize: 1024 * 1024 * 1024, // 1GB shared memory for Xvfb/Chrome
          RestartPolicy: { Name: 'unless-stopped' },
        },
      });

      await container.start();
      const containerId = container.id;

      await this.agentsService.updateStatus(agentId, 'starting', containerId);

      this.logger.log(`Started container ${containerId} for agent ${agent.slug}`);
      return { containerId };
    } catch (error) {
      await this.agentsService.updateStatus(agentId, 'error');
      throw error;
    }
  }

  async stopAgent(agentId: string): Promise<void> {
    const agent = await this.agentsService.findById(agentId);

    if (agent.streamingMode === 'external') {
      // No container to stop — force status reset + end stream record.
      // NOTE: The external encoder may still be sending data to MediaMTX.
      // If so, the next publish webhook will re-promote the agent to live.
      // To truly disconnect, the owner must stop their encoder or rotate the stream key.
      this.logger.log(
        `Force-offline for external agent "${agent.slug}" — encoder may still be active`,
      );
      await this.agentsService.updateStatus(agentId, 'offline', null);
      await this.streamsService.endStream(agentId);
      return;
    }

    if (agent.containerId) {
      try {
        const container = this.docker.getContainer(agent.containerId);
        await container.stop({ t: 10 });
        await container.remove({ force: true });
        this.logger.log(`Stopped container ${agent.containerId} for agent ${agent.slug}`);
      } catch (error) {
        this.logger.warn(`Failed to stop container: ${error.message}`);
      }
    }

    await this.agentsService.updateStatus(agentId, 'offline', null);
  }

  async restartAgent(agentId: string): Promise<{ containerId: string }> {
    const agent = await this.agentsService.findById(agentId);
    if (agent.streamingMode === 'external') {
      throw new BadRequestException(
        'This agent uses an external encoder. Switch to native mode in settings first.',
      );
    }
    await this.stopAgent(agentId);
    return this.startAgent(agentId);
  }

  async getAgentLogs(agentId: string, tail: number = 100): Promise<string> {
    const agent = await this.agentsService.findById(agentId);
    if (!agent.containerId) return 'No container running';

    try {
      const container = this.docker.getContainer(agent.containerId);
      const logs = await container.logs({
        stdout: true,
        stderr: true,
        tail,
        timestamps: true,
      });
      return logs.toString();
    } catch {
      return 'Failed to fetch logs';
    }
  }
}
