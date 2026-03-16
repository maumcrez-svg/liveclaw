import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { CryptoDonationService } from '../crypto/crypto-donation.service';
import { EthPriceService } from '../crypto/eth-price.service';
import { SubscriptionsService } from './subscriptions.service';

const TIER_PRICES: Record<string, number> = {
  tier_1: 4.99,
  tier_2: 9.99,
  tier_3: 24.99,
};

@Injectable()
export class CryptoSubscribeService {
  private readonly logger = new Logger(CryptoSubscribeService.name);

  constructor(
    private readonly cryptoDonationService: CryptoDonationService,
    private readonly ethPriceService: EthPriceService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  async initiateSubscription(
    userId: string,
    agentId: string,
    tier: string,
  ) {
    const price = TIER_PRICES[tier];
    if (!price) {
      throw new BadRequestException(
        `Invalid tier. Must be one of: ${Object.keys(TIER_PRICES).join(', ')}`,
      );
    }

    // Check no active subscription
    await this.subscriptionsService.checkNoActiveSubscription(userId, agentId);

    // Get ETH equivalent
    const ethAmount = this.ethPriceService.usdToEth(price);
    if (ethAmount === null) {
      throw new BadRequestException('ETH price not available. Try again shortly.');
    }

    // Create a crypto donation record with type='subscription'
    const donation = await this.cryptoDonationService.initiateDonation(
      agentId,
      userId,
      price,
      'base',
      'ETH',
      `Subscription: ${tier}`,
    );

    // Update the donation to mark it as a subscription payment
    // We need to use the repo directly via the service
    const updated = Object.assign(donation, {
      type: 'subscription' as const,
      tier,
    });
    // Save through the underlying mechanism
    await (this.cryptoDonationService as any).donationRepo.save(updated);

    return {
      paymentId: donation.id,
      recipientAddress: donation.recipientAddress,
      ethAmount: parseFloat(ethAmount.toFixed(9)),
      usdAmount: price,
      tier,
      expiresAt: donation.expiresAt,
    };
  }

  async submitSubscriptionTx(
    paymentId: string,
    txHash: string,
    senderAddress: string | undefined,
    userId: string,
  ) {
    return this.cryptoDonationService.submitTxHash(
      paymentId,
      txHash,
      senderAddress,
      userId,
    );
  }
}
