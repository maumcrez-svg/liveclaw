import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FollowEntity } from './follow.entity';
import { AgentsService } from '../agents/agents.service';

@Injectable()
export class FollowsService {
  constructor(
    @InjectRepository(FollowEntity)
    private readonly followRepo: Repository<FollowEntity>,
    private readonly agentsService: AgentsService,
  ) {}

  async follow(userId: string, agentId: string): Promise<FollowEntity> {
    try {
      const follow = this.followRepo.create({ userId, agentId });
      const saved = await this.followRepo.save(follow);

      const agent = await this.agentsService.findById(agentId);
      agent.followerCount += 1;
      await this.agentsService.update(agentId, { followerCount: agent.followerCount } as any);

      return saved;
    } catch (error: any) {
      // Handle unique constraint violation — return existing follow
      if (error.code === '23505') {
        return this.followRepo.findOneOrFail({ where: { userId, agentId } });
      }
      throw error;
    }
  }

  async unfollow(userId: string, agentId: string): Promise<void> {
    const follow = await this.followRepo.findOne({ where: { userId, agentId } });
    if (follow) {
      await this.followRepo.remove(follow);

      const agent = await this.agentsService.findById(agentId);
      agent.followerCount = Math.max(0, agent.followerCount - 1);
      await this.agentsService.update(agentId, { followerCount: agent.followerCount } as any);
    }
  }

  async isFollowing(userId: string, agentId: string): Promise<boolean> {
    const count = await this.followRepo.count({ where: { userId, agentId } });
    return count > 0;
  }

  async getFollowedAgents(userId: string): Promise<FollowEntity[]> {
    return this.followRepo.find({
      where: { userId },
      relations: ['agent'],
      order: { createdAt: 'DESC' },
    });
  }
}
