import { Controller, Get } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import Redis from 'ioredis';
import Dockerode from 'dockerode';
import * as fs from 'fs';

@Controller('health')
export class HealthController {
  private startTime = Date.now();
  private docker: Dockerode | null = null;
  private dockerAvailable = false;
  private mediamtxConfigured = false;

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {
    // Only init Docker if socket exists
    const socketPath = '/var/run/docker.sock';
    if (fs.existsSync(socketPath)) {
      this.docker = new Dockerode({ socketPath });
      this.dockerAvailable = true;
    }

    // MediaMTX is configured if env var is explicitly set
    const mediamtxUrl = this.config.get('MEDIAMTX_API_URL');
    this.mediamtxConfigured = !!mediamtxUrl;
  }

  @Get()
  async check() {
    const [db, redis, mediamtx, containers] = await Promise.all([
      this.checkDb(),
      this.checkRedis(),
      this.checkMediaMtx(),
      this.checkContainers(),
    ]);

    const uptimeSeconds = Math.floor((Date.now() - this.startTime) / 1000);
    const coreOk = db === 'ok' && redis === 'ok';

    return {
      status: coreOk ? 'ok' : 'degraded',
      db,
      redis,
      mediamtx,
      containers,
      uptime: `${uptimeSeconds}s`,
    };
  }

  private async checkDb(): Promise<string> {
    try {
      await this.dataSource.query('SELECT 1');
      return 'ok';
    } catch {
      return 'error';
    }
  }

  private async checkRedis(): Promise<string> {
    const host = this.config.get('REDIS_HOST', 'localhost');
    const port = this.config.get<number>('REDIS_PORT', 6379);
    const client = new Redis({ host, port, connectTimeout: 3000, lazyConnect: true });
    try {
      await client.connect();
      const pong = await client.ping();
      await client.quit();
      return pong === 'PONG' ? 'ok' : 'error';
    } catch {
      try { client.disconnect(); } catch {}
      return 'error';
    }
  }

  private async checkMediaMtx(): Promise<string> {
    if (!this.mediamtxConfigured) return 'not_configured';
    const apiUrl = this.config.get('MEDIAMTX_API_URL');
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`${apiUrl}/v3/paths/list`, { signal: controller.signal });
      clearTimeout(timeout);
      return res.ok ? 'ok' : 'error';
    } catch {
      return 'error';
    }
  }

  private async checkContainers(): Promise<{ running: number; names: string[] }> {
    if (!this.dockerAvailable || !this.docker) {
      return { running: 0, names: [], status: 'not_configured' } as any;
    }
    try {
      const list = await this.docker.listContainers({ filters: { status: ['running'], name: ['liveclaw-agent-'] } });
      return {
        running: list.length,
        names: list.map((c) => c.Names?.[0]?.replace(/^\//, '') || 'unknown'),
      };
    } catch {
      return { running: -1, names: [] };
    }
  }
}
