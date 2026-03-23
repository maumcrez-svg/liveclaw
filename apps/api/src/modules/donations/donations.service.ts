import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DonationEntity } from './donation.entity';
import { ChatService } from '../chat/chat.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class DonationsService {
  private readonly logger = new Logger(DonationsService.name);

  constructor(
    @InjectRepository(DonationEntity)
    private readonly donationRepo: Repository<DonationEntity>,
    private readonly chatService: ChatService,
    private readonly usersService: UsersService,
  ) {}

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
      .where('d.agentId = :agentId', { agentId })
      .andWhere('d.paymentStatus = :status', { status: 'completed' })
      .getRawOne();

    const recent = await this.donationRepo
      .createQueryBuilder('d')
      .leftJoinAndSelect('d.user', 'user')
      .where('d.agentId = :agentId', { agentId })
      .andWhere('d.paymentStatus = :status', { status: 'completed' })
      .orderBy('d.createdAt', 'DESC')
      .take(20)
      .getMany();

    return {
      totalAmount: parseFloat(result.totalAmount) || 0,
      totalCount: parseInt(result.totalCount) || 0,
      recent,
    };
  }
}
