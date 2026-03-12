import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmoteEntity } from './emote.entity';
import { CreateEmoteDto } from './emotes.dto';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

const TIER_ORDER: Record<string, number> = {
  tier_1: 1,
  tier_2: 2,
  tier_3: 3,
};

@Injectable()
export class EmotesService {
  constructor(
    @InjectRepository(EmoteEntity)
    private readonly emoteRepo: Repository<EmoteEntity>,
    @Inject(forwardRef(() => SubscriptionsService))
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  async getEmotesForAgent(agentId: string): Promise<EmoteEntity[]> {
    return this.emoteRepo.find({
      where: { agentId },
      order: { createdAt: 'DESC' },
    });
  }

  async getAvailableEmotes(
    agentId: string,
    userId: string | null,
  ): Promise<EmoteEntity[]> {
    const allEmotes = await this.getEmotesForAgent(agentId);

    if (!userId) {
      return allEmotes.filter((emote) => emote.tier === null);
    }

    const userTier = await this.subscriptionsService.getSubscriberTier(
      userId,
      agentId,
    );

    return allEmotes.filter((emote) => {
      if (emote.tier === null) return true;
      if (!userTier) return false;
      const userTierLevel = TIER_ORDER[userTier] ?? 0;
      const emoteTierLevel = TIER_ORDER[emote.tier] ?? 0;
      return userTierLevel >= emoteTierLevel;
    });
  }

  async createEmote(dto: CreateEmoteDto): Promise<EmoteEntity> {
    const emote = this.emoteRepo.create(dto);
    return this.emoteRepo.save(emote);
  }

  async deleteEmote(id: string): Promise<void> {
    await this.emoteRepo.delete(id);
  }

  async resolveEmotes(
    content: string,
    agentId: string,
    userId: string | null,
  ): Promise<{ name: string; imageUrl: string }[]> {
    const matches = content.match(/:([\w]+):/g);
    if (!matches) return [];

    const availableEmotes = await this.getAvailableEmotes(agentId, userId);
    const emoteMap = new Map(
      availableEmotes.map((e) => [e.name, e.imageUrl]),
    );

    const resolved: { name: string; imageUrl: string }[] = [];
    const seen = new Set<string>();

    for (const match of matches) {
      const name = match.slice(1, -1); // strip surrounding colons
      if (emoteMap.has(name) && !seen.has(name)) {
        seen.add(name);
        resolved.push({ name, imageUrl: emoteMap.get(name)! });
      }
    }

    return resolved;
  }
}
