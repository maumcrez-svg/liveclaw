import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, LessThan } from 'typeorm';
import { Interval } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { CryptoDonationEntity } from './crypto-donation.entity';
import { EthPriceService } from './eth-price.service';
import { SubscriptionEntity } from '../subscriptions/subscription.entity';
import { AgentEntity } from '../agents/agent.entity';

@Injectable()
export class ChainVerificationService {
  private readonly logger = new Logger(ChainVerificationService.name);
  private provider: ethers.JsonRpcProvider;

  constructor(
    @InjectRepository(CryptoDonationEntity)
    private readonly donationRepo: Repository<CryptoDonationEntity>,
    @InjectRepository(SubscriptionEntity)
    private readonly subRepo: Repository<SubscriptionEntity>,
    @InjectRepository(AgentEntity)
    private readonly agentRepo: Repository<AgentEntity>,
    private readonly config: ConfigService,
    private readonly ethPriceService: EthPriceService,
  ) {
    const rpcUrl = this.config.get('BASE_RPC_URL', 'https://mainnet.base.org');
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
  }

  @Interval(30_000)
  async verifyPendingDonations(): Promise<void> {
    try {
      const pending = await this.donationRepo.find({
        where: { status: In(['pending', 'confirming']) },
        take: 50,
      });

      for (const donation of pending) {
        await this.verifyOne(donation);
      }

      // Expire old initiated donations (> 15 min)
      const cutoff = new Date();
      cutoff.setMinutes(cutoff.getMinutes() - 15);
      await this.donationRepo
        .createQueryBuilder()
        .update()
        .set({ status: 'expired' })
        .where('status = :status', { status: 'initiated' })
        .andWhere('expires_at < :cutoff', { cutoff })
        .execute();
    } catch (err) {
      this.logger.error('Verification cron failed', err);
    }
  }

  async verifyImmediately(donationId: string): Promise<void> {
    const donation = await this.donationRepo.findOne({
      where: { id: donationId },
    });
    if (donation && donation.status === 'pending') {
      await this.verifyOne(donation);
    }
  }

  private async verifyOne(donation: CryptoDonationEntity): Promise<void> {
    if (!donation.txHash) return;

    try {
      const receipt = await this.provider.getTransactionReceipt(donation.txHash);
      if (!receipt) {
        // Not mined yet — mark confirming if still pending
        if (donation.status === 'pending') {
          donation.status = 'confirming';
          await this.donationRepo.save(donation);
        }
        return;
      }

      if (receipt.status !== 1) {
        donation.status = 'failed';
        await this.donationRepo.save(donation);
        this.logger.warn(`Tx ${donation.txHash} failed on-chain`);
        return;
      }

      // Verify recipient matches
      const tx = await this.provider.getTransaction(donation.txHash);
      if (!tx) {
        return;
      }

      const recipientMatch =
        tx.to?.toLowerCase() === donation.recipientAddress.toLowerCase();

      if (!recipientMatch) {
        donation.status = 'failed';
        await this.donationRepo.save(donation);
        this.logger.warn(
          `Tx ${donation.txHash} recipient mismatch: expected ${donation.recipientAddress}, got ${tx.to}`,
        );
        return;
      }

      // Confirm
      donation.status = 'confirmed';
      donation.verifiedOnChain = true;
      donation.blockNumber = receipt.blockNumber.toString();
      donation.confirmedAt = new Date();

      // Set USD value from ETH amount on chain
      const ethValue = parseFloat(ethers.formatEther(tx.value));
      const usdValue = this.ethPriceService.ethToUsd(ethValue);
      if (usdValue !== null) {
        donation.amountUsd = Math.round(usdValue * 100) / 100;
      }

      if (donation.senderAddress === null && tx.from) {
        donation.senderAddress = tx.from;
      }

      await this.donationRepo.save(donation);
      this.logger.log(
        `Confirmed donation ${donation.id}: ${ethValue} ETH ($${donation.amountUsd}) in block ${receipt.blockNumber}`,
      );

      // If this is a subscription payment, create the subscription
      if (donation.type === 'subscription' && donation.subscriptionId) {
        await this.activateSubscription(donation);
      }
    } catch (err) {
      this.logger.error(
        `Failed to verify tx ${donation.txHash}: ${err}`,
      );
    }
  }

  private async activateSubscription(
    donation: CryptoDonationEntity,
  ): Promise<void> {
    try {
      // Check if subscription already activated
      const existing = await this.subRepo.findOne({
        where: { id: donation.subscriptionId! },
      });
      if (existing) return; // Already created

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      const sub = this.subRepo.create({
        userId: donation.viewerUserId!,
        agentId: donation.agentId,
        tier: donation.tier || 'tier_1',
        startedAt: new Date(),
        expiresAt,
        isActive: true,
      });
      await this.subRepo.save(sub);

      // Increment subscriber count
      await this.agentRepo
        .createQueryBuilder()
        .update()
        .set({ subscriberCount: () => 'subscriber_count + 1' })
        .where('id = :id', { id: donation.agentId })
        .execute();

      this.logger.log(
        `Subscription activated for user ${donation.viewerUserId} -> agent ${donation.agentId}`,
      );
    } catch (err) {
      this.logger.error(`Failed to activate subscription: ${err}`);
    }
  }
}
