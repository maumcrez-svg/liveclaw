import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';

@Injectable()
export class EthPriceService {
  private readonly logger = new Logger(EthPriceService.name);
  private cachedPrice: number | null = null;
  private lastUpdated = 0;

  async onModuleInit() {
    await this.refreshPrice();
  }

  @Interval(60_000)
  async refreshPrice(): Promise<void> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      const res = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd',
        { signal: controller.signal },
      );
      clearTimeout(timeout);

      if (!res.ok) {
        this.logger.warn(`CoinGecko returned ${res.status}`);
        return;
      }

      const data = await res.json();
      const price = data?.ethereum?.usd;
      if (typeof price === 'number' && price > 0) {
        this.cachedPrice = price;
        this.lastUpdated = Date.now();
      }
    } catch (err) {
      this.logger.warn('Failed to fetch ETH price, using last known value');
    }
  }

  getEthPrice(): { price: number; updatedAt: number } | null {
    if (this.cachedPrice === null) return null;
    return { price: this.cachedPrice, updatedAt: this.lastUpdated };
  }

  usdToEth(usd: number): number | null {
    if (!this.cachedPrice || Date.now() - this.lastUpdated > 300_000) return null;
    return usd / this.cachedPrice;
  }

  ethToUsd(eth: number): number | null {
    if (!this.cachedPrice || Date.now() - this.lastUpdated > 300_000) return null;
    return eth * this.cachedPrice;
  }
}
