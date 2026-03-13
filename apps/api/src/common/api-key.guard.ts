import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request } from 'express';
import { createHash } from 'crypto';
import * as bcrypt from 'bcrypt';
import { AgentEntity } from '../modules/agents/agent.entity';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    @InjectRepository(AgentEntity)
    private readonly agentRepo: Repository<AgentEntity>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { agent: AgentEntity }>();
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing Bearer token');
    }

    const token = authHeader.slice(7);

    if (!token.startsWith('lc_')) {
      throw new UnauthorizedException('Invalid API key format');
    }

    const sha256 = createHash('sha256').update(token).digest('hex');
    const agent = await this.agentRepo.findOne({ where: { apiKeySha256: sha256 } });

    if (!agent || !agent.apiKeyHash) {
      throw new UnauthorizedException('Invalid API key');
    }

    const valid = await bcrypt.compare(token, agent.apiKeyHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid API key');
    }

    request.agent = agent;
    return true;
  }
}
