import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StreamEntity } from './stream.entity';
import { execFile } from 'child_process';
import { join } from 'path';
import { tmpdir } from 'os';
import { readFile, unlink } from 'fs/promises';

interface CachedThumbnail {
  buffer: Buffer;
  capturedAt: number;
}

@Injectable()
export class ThumbnailService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ThumbnailService.name);
  private interval: NodeJS.Timeout | null = null;
  private readonly hlsBaseUrl =
    process.env.MEDIAMTX_HLS_URL || 'http://localhost:8888';
  private generating = false;

  /** In-memory thumbnail cache: streamKey → JPEG buffer */
  private readonly cache = new Map<string, CachedThumbnail>();

  constructor(
    @InjectRepository(StreamEntity)
    private readonly streamRepo: Repository<StreamEntity>,
  ) {}

  onModuleInit() {
    this.interval = setInterval(() => this.generateThumbnails(), 60_000);
    setTimeout(() => this.generateThumbnails(), 15_000);
  }

  onModuleDestroy() {
    if (this.interval) clearInterval(this.interval);
  }

  /** Return cached JPEG buffer for a stream key, or null. */
  getThumbnail(streamKey: string): Buffer | null {
    const cached = this.cache.get(streamKey);
    if (!cached) return null;
    // Expire after 5 minutes
    if (Date.now() - cached.capturedAt > 5 * 60_000) {
      this.cache.delete(streamKey);
      return null;
    }
    return cached.buffer;
  }

  private async generateThumbnails() {
    if (this.generating) return;
    this.generating = true;

    try {
      const liveStreams = await this.streamRepo.find({
        where: { isLive: true },
        relations: ['agent'],
      });

      // Evict stale entries
      const liveKeys = new Set(
        liveStreams.map((s) => s.agent?.streamKey).filter(Boolean),
      );
      for (const key of this.cache.keys()) {
        if (!liveKeys.has(key)) this.cache.delete(key);
      }

      for (const stream of liveStreams) {
        if (!stream.agent?.streamKey) continue;
        try {
          await this.captureFrame(stream);
        } catch (err) {
          this.logger.warn(
            `Thumbnail capture failed for ${stream.agent.slug}: ${err}`,
          );
        }
      }
    } finally {
      this.generating = false;
    }
  }

  private captureFrame(stream: StreamEntity): Promise<void> {
    const hlsUrl = `${this.hlsBaseUrl}/${stream.agent.streamKey}/index.m3u8`;
    const tmpPath = join(tmpdir(), `thumb-${stream.agent.streamKey}.jpg`);

    return new Promise((resolve, reject) => {
      execFile(
        'ffmpeg',
        [
          '-y',
          '-i', hlsUrl,
          '-vframes', '1',
          '-s', '640x360',
          '-q:v', '2',
          tmpPath,
        ],
        { timeout: 15_000 },
        async (error) => {
          if (error) {
            reject(error);
            return;
          }
          try {
            const buffer = await readFile(tmpPath);
            await unlink(tmpPath).catch(() => {});
            this.cache.set(stream.agent.streamKey, {
              buffer,
              capturedAt: Date.now(),
            });
            // Store endpoint URL in DB for frontend compatibility
            const thumbnailUrl = `/streams/thumbnail/${stream.agent.streamKey}`;
            await this.streamRepo
              .update(stream.id, { thumbnailUrl })
              .catch(() => {});
            resolve();
          } catch (e) {
            reject(e);
          }
        },
      );
    });
  }
}
