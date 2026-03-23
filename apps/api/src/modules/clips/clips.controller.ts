import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Res,
  NotFoundException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { Response } from 'express';
import { join } from 'path';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/auth.decorator';
import { ClipsService } from './clips.service';
import { ClipProcessorService } from './clip-processor.service';
import { CreateClipDto } from './clips.dto';

interface JwtPayload {
  sub: string;
  username: string;
  role: string;
}

@Controller('clips')
export class ClipsController {
  private readonly clipsDir: string;

  constructor(
    private readonly clipsService: ClipsService,
    private readonly processor: ClipProcessorService,
  ) {
    this.clipsDir =
      process.env.CLIPS_STORAGE_DIR ||
      join(process.cwd(), 'data', 'clips');
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 3600000 } })
  async create(
    @Body() dto: CreateClipDto,
    @CurrentUser() user: JwtPayload,
  ) {
    if (this.processor.isQueueFull) {
      throw new HttpException(
        'Clip processing queue is full — try again in a few minutes',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const clip = await this.clipsService.create(dto, user.sub);
    return {
      id: clip.id,
      shareId: clip.shareId,
      status: clip.status,
      title: clip.title,
      durationSeconds: clip.durationSeconds,
    };
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  async getMyClips(
    @CurrentUser() user: JwtPayload,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.clipsService.findByUser(
      user.sub,
      Math.min(parseInt(limit || '20', 10) || 20, 50),
      parseInt(offset || '0', 10) || 0,
    );
  }

  @Get('agent/:agentId')
  @SkipThrottle()
  async getAgentClips(
    @Param('agentId') agentId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.clipsService.findByAgent(
      agentId,
      Math.min(parseInt(limit || '20', 10) || 20, 50),
      parseInt(offset || '0', 10) || 0,
    );
  }

  @Get(':shareId/status')
  @UseGuards(JwtAuthGuard)
  async getStatus(
    @Param('shareId') shareId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.clipsService.getStatus(shareId, user.sub);
  }

  @Get(':shareId')
  @SkipThrottle()
  async getClip(@Param('shareId') shareId: string) {
    const clip = await this.clipsService.findByShareIdAndIncrementViews(shareId);
    return {
      id: clip.id,
      shareId: clip.shareId,
      title: clip.title,
      description: clip.description,
      durationSeconds: clip.durationSeconds,
      status: clip.status,
      viewCount: clip.viewCount,
      videoPath: clip.videoPath,
      thumbnailPath: clip.thumbnailPath,
      createdAt: clip.createdAt,
      agent: clip.agent
        ? {
            id: clip.agent.id,
            slug: clip.agent.slug,
            name: clip.agent.name,
            avatarUrl: clip.agent.avatarUrl,
            status: clip.agent.status,
          }
        : null,
      creator: clip.creator
        ? {
            id: clip.creator.id,
            username: clip.creator.username,
            avatarUrl: clip.creator.avatarUrl,
          }
        : null,
    };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async deleteClip(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.clipsService.delete(id, user.sub, user.role);
    return { message: 'Clip deleted' };
  }
}

@Controller('clips-media')
export class ClipsMediaController {
  private readonly clipsDir: string;

  constructor() {
    this.clipsDir =
      process.env.CLIPS_STORAGE_DIR ||
      join(process.cwd(), 'data', 'clips');
  }

  @Get(':filename')
  @SkipThrottle()
  serveFile(@Param('filename') filename: string, @Res() res: Response) {
    // Sanitize: only allow alphanumeric, dash, underscore, dot
    if (!/^[a-zA-Z0-9_-]+\.(mp4|jpg)$/.test(filename)) {
      throw new NotFoundException('File not found');
    }

    const isVideo = filename.endsWith('.mp4');
    res.setHeader(
      'Content-Type',
      isVideo ? 'video/mp4' : 'image/jpeg',
    );
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.sendFile(filename, { root: this.clipsDir }, (err) => {
      if (err && !res.headersSent) {
        res.status(404).json({ statusCode: 404, message: 'File not found' });
      }
    });
  }
}
