import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { spawn } from 'child_process';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { ClipEntity } from './clip.entity';

const MAX_CONCURRENT = 2;
const MAX_QUEUE_SIZE = 20;
const FFMPEG_TIMEOUT_MS = 120_000;
const HLS_SEGMENT_DURATION = 2;
const HLS_SEGMENT_COUNT = 90;
const APPROX_BUFFER = HLS_SEGMENT_COUNT * HLS_SEGMENT_DURATION;

interface ClipJob {
  clipId: string;
  streamKey: string;
  duration: number;
  shareId: string;
  offsetFromEnd?: number;
}

@Injectable()
export class ClipProcessorService {
  private readonly logger = new Logger(ClipProcessorService.name);
  private readonly clipsDir: string;
  private readonly mediamtxHlsUrl: string;
  private running = 0;
  private readonly queue: ClipJob[] = [];

  constructor(
    @InjectRepository(ClipEntity)
    private readonly clipRepo: Repository<ClipEntity>,
  ) {
    this.clipsDir =
      process.env.CLIPS_STORAGE_DIR || join(process.cwd(), 'data', 'clips');
    this.mediamtxHlsUrl =
      process.env.MEDIAMTX_HLS_URL || 'http://mediamtx:8888';

    if (!existsSync(this.clipsDir)) {
      mkdirSync(this.clipsDir, { recursive: true });
      this.logger.log(`Created clips directory: ${this.clipsDir}`);
    }
  }

  get queueSize(): number {
    return this.queue.length;
  }

  get isQueueFull(): boolean {
    return this.queue.length >= MAX_QUEUE_SIZE;
  }

  enqueue(
    clipId: string,
    streamKey: string,
    duration: number,
    shareId: string,
    offsetFromEnd?: number,
  ): void {
    if (this.queue.length >= MAX_QUEUE_SIZE) {
      void this.clipRepo.update(clipId, {
        status: 'failed',
        errorMessage: 'Processing queue full — try again later',
      });
      return;
    }
    const job: ClipJob = { clipId, streamKey, duration, shareId, offsetFromEnd };
    this.queue.push(job);
    this.processNext();
  }

  deleteFiles(shareId: string): void {
    const videoPath = join(this.clipsDir, `${shareId}.mp4`);
    const thumbPath = join(this.clipsDir, `${shareId}.jpg`);
    try {
      if (existsSync(videoPath)) unlinkSync(videoPath);
    } catch (err) {
      this.logger.warn(`Failed to delete video ${videoPath}: ${err}`);
    }
    try {
      if (existsSync(thumbPath)) unlinkSync(thumbPath);
    } catch (err) {
      this.logger.warn(`Failed to delete thumbnail ${thumbPath}: ${err}`);
    }
  }

  private async processNext(): Promise<void> {
    if (this.running >= MAX_CONCURRENT || this.queue.length === 0) return;

    const job = this.queue.shift()!;
    this.running++;

    try {
      await this.processJob(job);
    } catch (err) {
      this.logger.error(`Job ${job.shareId} crashed: ${err}`);
    } finally {
      this.running--;
      this.processNext();
    }
  }

  private async processJob(job: ClipJob): Promise<void> {
    const { clipId, streamKey, duration, shareId, offsetFromEnd } = job;

    await this.clipRepo.update(clipId, { status: 'processing' });

    const hlsUrl = `${this.mediamtxHlsUrl}/${streamKey}/index.m3u8`;
    const videoPath = join(this.clipsDir, `${shareId}.mp4`);
    const thumbPath = join(this.clipsDir, `${shareId}.jpg`);

    try {
      this.logger.log(`Processing clip ${shareId}: ${duration}s`);

      const inputArgs: string[] = [];

      if (offsetFromEnd != null && offsetFromEnd > 0) {
        // Precise mode: seek into the HLS buffer
        const seekFromStart = Math.max(0, APPROX_BUFFER - offsetFromEnd);
        inputArgs.push('-i', hlsUrl, '-ss', String(seekFromStart));
      } else {
        // Legacy preset mode: grab from near the end
        const segmentsNeeded = Math.ceil(duration / HLS_SEGMENT_DURATION);
        inputArgs.push(
          '-live_start_index',
          String(-segmentsNeeded),
          '-i',
          hlsUrl,
        );
      }

      await this.runFfmpeg([
        ...inputArgs,
        '-t',
        String(duration),
        '-c:v',
        'libx264',
        '-preset',
        'fast',
        '-crf',
        '23',
        '-c:a',
        'aac',
        '-b:a',
        '128k',
        '-movflags',
        '+faststart',
        '-y',
        videoPath,
      ]);

      // Generate thumbnail from clip midpoint
      const thumbSeek = Math.min(1, duration / 2);
      await this.runFfmpeg([
        '-i',
        videoPath,
        '-ss',
        String(thumbSeek),
        '-vframes',
        '1',
        '-vf',
        'scale=640:-2',
        '-q:v',
        '3',
        '-y',
        thumbPath,
      ]);

      await this.clipRepo.update(clipId, {
        status: 'ready',
        videoPath: `${shareId}.mp4`,
        thumbnailPath: `${shareId}.jpg`,
      });

      this.logger.log(`Clip ${shareId} ready`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Clip ${shareId} failed: ${message}`);
      await this.clipRepo.update(clipId, {
        status: 'failed',
        errorMessage: message.slice(0, 500),
      });
      this.deleteFiles(shareId);
    }
  }

  private runFfmpeg(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn('ffmpeg', [
        '-hide_banner',
        '-loglevel',
        'warning',
        ...args,
      ]);

      let stderr = '';
      proc.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      const timeout = setTimeout(() => {
        proc.kill('SIGKILL');
        reject(new Error(`FFmpeg timed out after ${FFMPEG_TIMEOUT_MS}ms`));
      }, FFMPEG_TIMEOUT_MS);

      proc.on('close', (code) => {
        clearTimeout(timeout);
        if (code === 0) {
          resolve();
        } else {
          reject(
            new Error(
              `FFmpeg exited with code ${code}: ${stderr.slice(-300)}`,
            ),
          );
        }
      });

      proc.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }
}
