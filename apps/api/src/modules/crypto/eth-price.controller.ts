import { Controller, Get } from '@nestjs/common';
import { EthPriceService } from './eth-price.service';

@Controller('crypto')
export class EthPriceController {
  constructor(private readonly ethPriceService: EthPriceService) {}

  @Get('eth-price')
  getEthPrice() {
    const data = this.ethPriceService.getEthPrice();
    if (!data) {
      return { price: null, updatedAt: null, available: false };
    }
    return { ...data, available: true };
  }
}
