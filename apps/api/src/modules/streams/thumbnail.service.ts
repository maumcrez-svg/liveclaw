import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StreamEntity } from './stream.entity';
import { execFile } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

@Injectable()
export class ThumbnailService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ThumbnailService.name);
  private interval: NodeJS.Timeout | null = null;
  private readonly thumbnailDir = join(process.cwd(), 'thumbnails');
  private readonly hlsBaseUrl =
    process.env.MEDIAMTX_HLS_URL || 'http://localhost:8888';
  private generating = false;

  constructor(
    @InjectRepository(StreamEntity)
    private readonly streamRepo: Repository<StreamEntity>,
  ) {}

  onModuleInit() {
    if (!existsSync(this.thumbnailDir)) {
      mkdirSync(this.thumbnailDir, { recursive: true });
    }
    this.interval = setInterval(() => this.generateThumbnails(), 60_000);
    // Generate once on startup after a short delay for HLS to be ready
    setTimeout(() => this.generateThumbnails(), 15_000);
  }

  onModuleDestroy() {
    if (this.interval) clearInterval(this.interval);
  }

  private async generateThumbnails() {
    // Prevent overlapping runs
    if (this.generating) return;
    this.generating = true;

    try {
      const liveStreams = await this.streamRepo.find({
        where: { isLive: true },
        relations: ['agent'],
      });

      for (const stream of liveStreams) {
        if (!stream.agent?.streamKey) continue;
        try {
          await this.captureFrame(stream);
        } catch (err) {
          // Keep existing thumbnail on failure — don't clear it
          this.logger.warn(
            `Thumbnail capture failed for stream ${stream.id}: ${err}`,
          );
        }
      }
    } finally {
      this.generating = false;
    }
  }

  private captureFrame(stream: StreamEntity): Promise<void> {
    const hlsUrl = `${this.hlsBaseUrl}/${stream.agent.streamKey}/index.m3u8`;
    const outputPath = join(this.thumbnailDir, `${stream.id}.jpg`);

    return new Promise((resolve, reject) => {
      execFile(
        'ffmpeg',
        [
          '-y',
          '-i',
          hlsUrl,
          '-vframes',
          '1',
          '-s',
          '640x360',
          '-q:v',
          '2',
          outputPath,
        ],
        { timeout: 15_000 },
        async (error) => {
          if (error) {
            reject(error);
            return;
          }
          try {
            // Store relative URL with cache-bust timestamp
            const thumbnailUrl = `/thumbnails/${stream.id}.jpg?v=${Date.now()}`;
            await this.streamRepo.update(stream.id, { thumbnailUrl });
            resolve();
          } catch (dbErr) {
            reject(dbErr);
          }
        },
      );
    });
  }
}
