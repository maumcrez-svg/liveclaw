import { Injectable, Optional, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FollowEntity } from './follow.entity';
import { AgentsService } from '../agents/agents.service';
import { ChatService } from '../chat/chat.service';
import { UsersService } from '../users/users.service';
import { StreamEntity } from '../streams/stream.entity';

@Injectable()
export class FollowsService {
  constructor(
    @InjectRepository(FollowEntity)
    private readonly followRepo: Repository<FollowEntity>,
    private readonly agentsService: AgentsService,
    @Optional() @Inject(forwardRef(() => ChatService))
    private readonly chatService: ChatService,
    @Optional() @Inject(forwardRef(() => UsersService))
    private readonly usersService: UsersService,
    @InjectRepository(StreamEntity)
    private readonly streamRepo: Repository<StreamEntity>,
  ) {}

  async follow(userId: string, agentId: string): Promise<FollowEntity> {
    try {
      const follow = this.followRepo.create({ userId, agentId });
      const saved = await this.followRepo.save(follow);

      const agent = await this.agentsService.findById(agentId);
      agent.followerCount += 1;
      await this.agentsService.update(agentId, { followerCount: agent.followerCount } as any);

      // Emit follow alert to live stream
      try {
        if (this.chatService && this.usersService) {
          const user = await this.usersService.findById(userId);
          const liveStream = await this.streamRepo.findOne({
            where: { agentId, isLive: true },
          });
          if (liveStream) {
            await this.chatService.publishAlert(liveStream.id, {
              id: `follow_${Date.now()}`,
              type: 'follow',
              username: user.username,
              timestamp: new Date().toISOString(),
            });
          }
        }
      } catch (err) {
        // Alerts are non-critical — never block the follow operation
      }

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
