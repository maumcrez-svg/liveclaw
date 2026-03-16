import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { CryptoDonationService } from '../crypto/crypto-donation.service';
import { EthPriceService } from '../crypto/eth-price.service';
import { SubscriptionsService } from './subscriptions.service';
import { TIER_PRICES_ETH } from '../../common/pricing.constants';

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
    const price = TIER_PRICES_ETH[tier];
    if (!price) {
      throw new BadRequestException(
        `Invalid tier. Must be one of: ${Object.keys(TIER_PRICES_ETH).join(', ')}`,
      );
    }

    // Check no active subscription
    await this.subscriptionsService.checkNoActiveSubscription(userId, agentId);

    // Price is already in ETH — no conversion needed
    const ethAmount = price;

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
      ethPrice: price,
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
