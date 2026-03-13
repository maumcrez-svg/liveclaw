import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StreamEntity } from './stream.entity';

const THUMBNAIL_BASE_URL =
  process.env.THUMBNAIL_BASE_URL || 'http://165.227.91.241:8889';

@Injectable()
export class ThumbnailService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ThumbnailService.name);
  private interval: NodeJS.Timeout | null = null;

  constructor(
    @InjectRepository(StreamEntity)
    private readonly streamRepo: Repository<StreamEntity>,
  ) {}

  onModuleInit() {
    this.interval = setInterval(() => this.updateThumbnailUrls(), 60_000);
    setTimeout(() => this.updateThumbnailUrls(), 15_000);
  }

  onModuleDestroy() {
    if (this.interval) clearInterval(this.interval);
  }

  /**
   * Update thumbnailUrl for live streams to point to the DO thumbnail server.
   * Actual frame capture happens on the DO server via cron + FFmpeg.
   */
  private async updateThumbnailUrls() {
    try {
      const liveStreams = await this.streamRepo.find({
        where: { isLive: true },
        relations: ['agent'],
      });

      for (const stream of liveStreams) {
        if (!stream.agent?.streamKey) continue;
        const thumbnailUrl = `${THUMBNAIL_BASE_URL}/${stream.agent.streamKey}.jpg?v=${Date.now()}`;
        await this.streamRepo
          .update(stream.id, { thumbnailUrl })
          .catch(() => {});
      }
    } catch (err) {
      this.logger.warn(`Failed to update thumbnail URLs: ${err}`);
    }
  }
}
