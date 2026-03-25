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

    // SHA-256 lookup is sufficient for API keys with 128 bits of entropy.
    // bcrypt is designed for weak passwords, not high-entropy random tokens.
    const sha256 = createHash('sha256').update(token).digest('hex');
    const agent = await this.agentRepo.findOne({ where: { apiKeySha256: sha256 } });

    if (!agent) {
      throw new UnauthorizedException('Invalid API key');
    }

    request.agent = agent;
    return true;
  }
}
