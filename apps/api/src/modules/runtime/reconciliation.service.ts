import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import Dockerode from 'dockerode';
import { AgentsService } from '../agents/agents.service';
import { StreamsService } from '../streams/streams.service';

/**
 * Reconciliation loop that keeps DB state in sync with Docker and MediaMTX.
 *
 * Runs every 30 seconds and only **degrades** status (live → offline).
 * Promotion (offline → live) is exclusively handled by MediaMTX webhooks.
 */
@Injectable()
export class ReconciliationService implements OnModuleInit {
  private readonly logger = new Logger(ReconciliationService.name);
  private readonly docker: Dockerode;
  private readonly mediamtxApiUrl: string;
  private dockerAvailable = false;

  constructor(
    private readonly agentsService: AgentsService,
    private readonly streamsService: StreamsService,
    private readonly configService: ConfigService,
  ) {
    this.docker = new Dockerode({ socketPath: '/var/run/docker.sock' });
    this.mediamtxApiUrl = this.configService.get<string>(
      'MEDIAMTX_API_URL',
      'http://localhost:9997',
    );
  }

  async onModuleInit() {
    try {
      await this.docker.ping();
      this.dockerAvailable = true;
      this.logger.log('Reconciliation loop initialized (30s interval) — Docker available');
    } catch {
      this.logger.log('Reconciliation loop initialized (30s interval) — Docker not available, skipping container checks');
    }
  }

  @Interval(30_000)
  async reconcile() {
    try {
      if (this.dockerAvailable) {
        await this.reconcileContainers();
      }
      await this.reconcileMediaMTXPaths();
      await this.reconcileOrphanStreams();
    } catch (error) {
      this.logger.error(`Reconciliation error: ${error.message}`);
    }
  }

  /**
   * Check agents that have a containerId in DB but container is dead/missing in Docker.
   */
  private async reconcileContainers() {
    const allAgents = await this.agentsService.findAllLightweight();
    const nonOfflineAgents = allAgents.filter(
      (a) =>
        a.streamingMode === 'native' &&
        (a.status !== 'offline' || a.containerId),
    );

    for (const agent of nonOfflineAgents) {
      if (!agent.containerId) {
        // Native agent has non-offline status but no container ID — reset to offline
        if (agent.status !== 'offline') {
          this.logger.warn(
            `[DEAD CONTAINER] Agent "${agent.slug}" status="${agent.status}" but no containerId — setting offline`,
          );
          await this.agentsService.updateStatus(agent.id, 'offline', null);
          await this.streamsService.endStream(agent.id);
        }
        continue;
      }

      try {
        const container = this.docker.getContainer(agent.containerId);
        const info = await container.inspect();
        const running = info.State?.Running ?? false;

        if (!running) {
          this.logger.warn(
            `[DEAD CONTAINER] Agent "${agent.slug}" container ${agent.containerId.slice(0, 12)} is not running (state=${info.State?.Status}) — setting offline`,
          );

          // Try to clean up the stopped container
          try {
            await container.remove({ force: true });
          } catch {
            // Already removed or inaccessible — fine
          }

          await this.agentsService.updateStatus(agent.id, 'offline', null);
          await this.streamsService.endStream(agent.id);
        }
      } catch (error) {
        // Container does not exist (404) or Docker is unreachable
        this.logger.warn(
          `[DEAD CONTAINER] Agent "${agent.slug}" container ${agent.containerId?.slice(0, 12)} not found in Docker — setting offline (${error.message})`,
        );
        await this.agentsService.updateStatus(agent.id, 'offline', null);
        await this.streamsService.endStream(agent.id);
      }
    }
  }

  /**
   * Check MediaMTX active paths vs DB state.
   * - Stream live in DB but no path in MediaMTX → end stream
   * - Path active in MediaMTX but agent offline in DB → log warning (webhook may be pending)
   */
  private async reconcileMediaMTXPaths() {
    let activePaths: Set<string>;
    try {
      activePaths = await this.getActiveMediaMTXPaths();
    } catch (error) {
      this.logger.warn(
        `[MEDIAMTX] Cannot reach MediaMTX API at ${this.mediamtxApiUrl}: ${error.message}`,
      );
      return;
    }

    // Check agents marked as live in DB but without an active path in MediaMTX
    const allAgents = await this.agentsService.findAllLightweight();
    const liveAgents = allAgents.filter((a) => a.status === 'live');

    for (const agent of liveAgents) {
      // External agents stream from outside — they don't go through this MediaMTX instance
      if (agent.streamingMode === 'external') continue;

      if (!activePaths.has(agent.streamKey)) {
        this.logger.warn(
          `[STREAM WITHOUT PATH] Agent "${agent.slug}" is live in DB but no active path in MediaMTX for streamKey — ending stream`,
        );
        await this.agentsService.updateStatus(agent.id, 'offline', null);
        await this.streamsService.endStream(agent.id);
      }
    }

    // Check active paths in MediaMTX with no corresponding live agent in DB
    const liveStreamKeys = new Set(liveAgents.map((a) => a.streamKey));
    for (const pathKey of activePaths) {
      if (!liveStreamKeys.has(pathKey)) {
        // Try to find the agent by stream key
        const agent = await this.agentsService.findByStreamKey(pathKey);
        if (agent) {
          this.logger.warn(
            `[GHOST PATH] Active MediaMTX path for agent "${agent.slug}" but agent status="${agent.status}" in DB — webhook may be pending`,
          );
        } else {
          this.logger.warn(
            `[GHOST PATH] Active MediaMTX path "${pathKey}" has no matching agent in DB`,
          );
        }
      }
    }
  }

  /**
   * Check for orphan streams: isLive=true in DB but agent is offline.
   */
  private async reconcileOrphanStreams() {
    const liveStreams = await this.streamsService.findLive();

    for (const stream of liveStreams) {
      if (!stream.agent) continue;
      if (stream.agent.status !== 'live') {
        this.logger.warn(
          `[ORPHAN STREAM] Stream ${stream.id} for agent "${stream.agent.slug}" is live in DB but agent status="${stream.agent.status}" — ending stream`,
        );
        await this.streamsService.endStream(stream.agentId);
      }
    }
  }

  /**
   * Fetch active paths from MediaMTX API v3.
   * Returns a set of path names (which are stream keys).
   */
  private async getActiveMediaMTXPaths(): Promise<Set<string>> {
    const url = `${this.mediamtxApiUrl}/v3/paths/list`;
    const response = await fetch(url, {
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`MediaMTX API returned ${response.status}`);
    }

    const data = await response.json();
    const paths = new Set<string>();

    // MediaMTX v3 API returns { items: [{ name, ... }] }
    if (data.items && Array.isArray(data.items)) {
      for (const item of data.items) {
        if (item.name && item.readers !== undefined) {
          paths.add(item.name);
        }
      }
    }

    return paths;
  }
}
