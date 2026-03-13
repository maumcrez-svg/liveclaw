import {
  Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, ForbiddenException,
} from '@nestjs/common';
import { AgentsService } from './agents.service';
import { CreateAgentDto, UpdateAgentDto, HeartbeatDto } from './agents.dto';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/auth.decorator';
import { OwnerGuard } from '../../common/owner.guard';
import { ApiKeyGuard } from '../../common/api-key.guard';
import { CurrentAgent } from '../../common/current-agent.decorator';
import { JwtPayload } from '../auth/auth.service';
import { AgentEntity } from './agent.entity';

@Controller('agents')
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Get()
  async findAll(@Query('category') categorySlug?: string) {
    const agents = categorySlug
      ? await this.agentsService.findByCategory(categorySlug)
      : await this.agentsService.findAll();
    return agents.map(stripSensitive);
  }

  @Get('live')
  async findLive() {
    const agents = await this.agentsService.findLive();
    return agents.map(stripSensitive);
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  findMine(@CurrentUser() user: JwtPayload) {
    return this.agentsService.findByOwner(user.sub);
  }

  @Get('me/sdk')
  @UseGuards(ApiKeyGuard)
  getAgentSelf(@CurrentAgent() agent: AgentEntity) {
    return stripSensitive(agent);
  }

  @Get('search')
  async search(@Query('q') query: string) {
    if (!query || query.length < 2) return [];
    const agents = await this.agentsService.search(query);
    return agents.map(stripSensitive);
  }

  @Get(':slug')
  async findBySlug(@Param('slug') slug: string) {
    const agent = await this.agentsService.findBySlug(slug);
    return stripSensitive(agent);
  }

  @Get(':slug/private')
  @UseGuards(JwtAuthGuard)
  async findBySlugPrivate(@Param('slug') slug: string, @CurrentUser() user: JwtPayload) {
    const agent = await this.agentsService.findBySlug(slug);
    if (user.role !== 'admin' && agent.ownerId !== user.sub) {
      const { streamKey, containerId, config, ...safe } = agent;
      return safe;
    }
    return agent;
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'creator')
  create(@Body() dto: CreateAgentDto, @CurrentUser() user: JwtPayload) {
    // Creators can only create agents for themselves; admins may assign to anyone.
    if (user.role !== 'admin') {
      dto.ownerId = user.sub;
    } else if (!dto.ownerId) {
      dto.ownerId = user.sub;
    }
    return this.agentsService.create(dto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, OwnerGuard)
  update(@Param('id') id: string, @Body() dto: UpdateAgentDto) {
    return this.agentsService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  delete(@Param('id') id: string) {
    return this.agentsService.delete(id);
  }

  @Post(':id/rotate-key')
  @UseGuards(JwtAuthGuard, OwnerGuard)
  rotateKey(@Param('id') id: string) {
    return this.agentsService.rotateStreamKey(id);
  }

  @Post(':id/rotate-api-key')
  @UseGuards(JwtAuthGuard, OwnerGuard)
  rotateApiKey(@Param('id') id: string) {
    return this.agentsService.rotateApiKey(id);
  }

  @Post(':id/heartbeat')
  @UseGuards(ApiKeyGuard)
  heartbeat(
    @Param('id') id: string,
    @CurrentAgent() agent: AgentEntity,
    @Body() dto: HeartbeatDto,
  ) {
    if (agent.id !== id) throw new ForbiddenException();
    return this.agentsService.heartbeat(id, dto);
  }
}

function stripSensitive(agent: any) {
  if (!agent) return agent;
  const { streamKey, containerId, config, apiKeyHash, apiKeySha256, ...safe } = agent;
  return safe;
}
