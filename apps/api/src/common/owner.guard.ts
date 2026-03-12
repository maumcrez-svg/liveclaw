import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request } from 'express';
import { AgentEntity } from '../modules/agents/agent.entity';
import { JwtPayload } from '../modules/auth/auth.service';

/**
 * Verifies that the authenticated user owns the target agent, or is an admin.
 *
 * Reads the agent id from route params in this priority order:
 *   1. :agentId
 *   2. :id
 *
 * Must be applied AFTER JwtAuthGuard so that request.user is populated.
 *
 * Usage:
 *   @UseGuards(JwtAuthGuard, OwnerGuard)
 *   @Delete(':id')
 *   deleteAgent(...) {}
 */
@Injectable()
export class OwnerGuard implements CanActivate {
  constructor(
    @InjectRepository(AgentEntity)
    private readonly agentRepo: Repository<AgentEntity>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user: JwtPayload }>();

    const user = request.user;
    if (!user) {
      throw new ForbiddenException('Not authenticated');
    }

    // Admins bypass ownership checks entirely
    if (user.role === 'admin') {
      return true;
    }

    const agentId: string | undefined =
      (request.params as Record<string, string>).agentId ??
      (request.params as Record<string, string>).id;

    if (!agentId) {
      throw new ForbiddenException('No agent id found in route params');
    }

    const agent = await this.agentRepo.findOne({ where: { id: agentId } });
    if (!agent) {
      throw new NotFoundException(`Agent ${agentId} not found`);
    }

    if (agent.ownerId !== user.sub) {
      throw new ForbiddenException('You do not own this agent');
    }

    return true;
  }
}
