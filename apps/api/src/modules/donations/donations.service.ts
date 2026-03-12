import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DonationEntity } from './donation.entity';
import { ChatService } from '../chat/chat.service';
import { UsersService } from '../users/users.service';

export interface CompleteDonationParams {
  stripeSessionId: string;
  userId: string;
  agentId: string;
  streamId: string | null;
  amount: number;
  message: string;
}

@Injectable()
export class DonationsService {
  private readonly logger = new Logger(DonationsService.name);

  constructor(
    @InjectRepository(DonationEntity)
    private readonly donationRepo: Repository<DonationEntity>,
    private readonly chatService: ChatService,
    private readonly usersService: UsersService,
  ) {}

  async completeDonation(params: CompleteDonationParams): Promise<DonationEntity | null> {
    // Idempotency: check if already processed
    const existing = await this.donationRepo.findOne({
      where: { stripeSessionId: params.stripeSessionId },
    });
    if (existing) {
      this.logger.log(`Donation already processed for session ${params.stripeSessionId}`);
      return existing;
    }

    const donation = this.donationRepo.create({
      userId: params.userId,
      agentId: params.agentId,
      streamId: params.streamId,
      amount: params.amount,
      currency: 'USD',
      message: params.message,
      stripeSessionId: params.stripeSessionId,
      paymentStatus: 'completed',
      paidAt: new Date(),
    });
    const saved = await this.donationRepo.save(donation);

    // Publish chat message
    try {
      const user = await this.usersService.findById(params.userId);
      if (params.streamId) {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8);
        await this.chatService.publishMessage(params.streamId, {
          id: `msg_${timestamp}_${random}`,
          streamId: params.streamId,
          username: user.username,
          content: params.message,
          type: 'donation',
          amount: params.amount,
          currency: 'USD',
          createdAt: new Date().toISOString(),
        });
      }
    } catch (err) {
      this.logger.warn(`Failed to publish donation chat message: ${err}`);
    }

    return saved;
  }

  async getStreamDonations(streamId: string): Promise<DonationEntity[]> {
    return this.donationRepo.find({
      where: { streamId },
      order: { createdAt: 'DESC' },
    });
  }

  async getDonationStats(agentId: string): Promise<{
    totalAmount: number;
    totalCount: number;
    recent: DonationEntity[];
  }> {
    const result = await this.donationRepo
      .createQueryBuilder('d')
      .select('COALESCE(SUM(d.amount), 0)', 'totalAmount')
      .addSelect('COUNT(*)::int', 'totalCount')
      .where('d.agent_id = :agentId', { agentId })
      .andWhere('d.payment_status = :status', { status: 'completed' })
      .andWhere('d.stripe_session_id IS NOT NULL')
      .getRawOne();

    const recent = await this.donationRepo
      .createQueryBuilder('d')
      .leftJoinAndSelect('d.user', 'user')
      .where('d.agent_id = :agentId', { agentId })
      .andWhere('d.payment_status = :status', { status: 'completed' })
      .andWhere('d.stripe_session_id IS NOT NULL')
      .orderBy('d.created_at', 'DESC')
      .take(20)
      .getMany();

    return {
      totalAmount: parseFloat(result.totalAmount) || 0,
      totalCount: parseInt(result.totalCount) || 0,
      recent,
    };
  }
}
