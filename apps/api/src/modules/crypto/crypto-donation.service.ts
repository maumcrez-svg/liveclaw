import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { CryptoDonationEntity } from './crypto-donation.entity';
import { CryptoWalletService } from './crypto-wallet.service';
import { EthPriceService } from './eth-price.service';

@Injectable()
export class CryptoDonationService {
  private readonly logger = new Logger(CryptoDonationService.name);
  private chainVerificationService: any = null;

  constructor(
    @InjectRepository(CryptoDonationEntity)
    private readonly donationRepo: Repository<CryptoDonationEntity>,
    private readonly walletService: CryptoWalletService,
    private readonly ethPriceService: EthPriceService,
  ) {}

  /** Lazy inject to avoid circular dependency */
  setChainVerificationService(service: any): void {
    this.chainVerificationService = service;
  }

  async initiateDonation(
    agentId: string,
    viewerUserId: string,
    amount: number,
    network: string,
    token: string,
    message?: string,
    streamId?: string,
  ): Promise<CryptoDonationEntity> {
    const wallet = await this.walletService.getWalletByAgent(agentId, network);
    if (!wallet) {
      throw new BadRequestException(
        'No wallet configured for this agent on the specified network',
      );
    }

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);

    // Convert USD amount to ETH
    const ethAmount = this.ethPriceService.usdToEth(amount);

    const donation = this.donationRepo.create({
      agentId,
      viewerUserId,
      streamId: streamId || null,
      network,
      token,
      amount: ethAmount ?? amount,
      amountUsd: amount,
      recipientAddress: wallet.address,
      message: message || null,
      status: 'initiated',
      expiresAt,
    });

    const saved = await this.donationRepo.save(donation);
    this.logger.log(
      `Crypto donation initiated: ${saved.id} for agent ${agentId}, amount=${amount} ${token}`,
    );
    return saved;
  }

  async submitTxHash(
    donationId: string,
    txHash: string,
    senderAddress?: string,
    userId?: string,
  ): Promise<CryptoDonationEntity> {
    const donation = await this.donationRepo.findOne({
      where: { id: donationId },
    });

    if (!donation) {
      throw new NotFoundException('Donation not found');
    }

    if (userId && donation.viewerUserId && donation.viewerUserId !== userId) {
      throw new ForbiddenException('This donation does not belong to you');
    }

    if (donation.status !== 'initiated') {
      throw new BadRequestException(
        `Cannot submit tx hash for donation with status "${donation.status}"`,
      );
    }

    if (donation.expiresAt && new Date() > donation.expiresAt) {
      donation.status = 'expired';
      await this.donationRepo.save(donation);
      throw new BadRequestException('Donation has expired');
    }

    donation.txHash = txHash;
    donation.status = 'pending';
    if (senderAddress) {
      donation.senderAddress = senderAddress;
    }

    const saved = await this.donationRepo.save(donation);
    this.logger.log(
      `Tx hash submitted for donation ${donationId}: ${txHash}`,
    );

    // Fire-and-forget immediate verification
    if (this.chainVerificationService) {
      this.chainVerificationService
        .verifyImmediately(donationId)
        .catch((err: any) =>
          this.logger.warn(`Immediate verify failed: ${err}`),
        );
    }

    return saved;
  }

  async getByAgent(agentId: string): Promise<CryptoDonationEntity[]> {
    return this.donationRepo.find({
      where: {
        agentId,
        status: In(['confirmed', 'pending', 'confirming']),
      },
      order: { createdAt: 'DESC' },
      relations: ['viewerUser'],
    });
  }

  async getByStream(streamId: string): Promise<CryptoDonationEntity[]> {
    return this.donationRepo.find({
      where: {
        streamId,
        status: 'confirmed',
      },
      order: { createdAt: 'DESC' },
      relations: ['viewerUser'],
    });
  }

  async getSummary(agentId: string): Promise<{
    totalConfirmed: number;
    totalPending: number;
    count: number;
    recentDonations: CryptoDonationEntity[];
  }> {
    const confirmedResult = await this.donationRepo
      .createQueryBuilder('d')
      .select('COALESCE(SUM(d.amount_usd), 0)', 'total')
      .where('d.agent_id = :agentId', { agentId })
      .andWhere('d.status = :status', { status: 'confirmed' })
      .getRawOne();

    const pendingResult = await this.donationRepo
      .createQueryBuilder('d')
      .select('COALESCE(SUM(d.amount_usd), 0)', 'total')
      .where('d.agent_id = :agentId', { agentId })
      .andWhere('d.status IN (:...statuses)', {
        statuses: ['pending', 'confirming'],
      })
      .getRawOne();

    const count = await this.donationRepo.count({
      where: { agentId, status: 'confirmed' },
    });

    const recentDonations = await this.donationRepo.find({
      where: {
        agentId,
        status: In(['confirmed', 'pending', 'confirming']),
      },
      order: { createdAt: 'DESC' },
      take: 10,
      relations: ['viewerUser'],
    });

    return {
      totalConfirmed: parseFloat(confirmedResult.total),
      totalPending: parseFloat(pendingResult.total),
      count,
      recentDonations,
    };
  }
}
