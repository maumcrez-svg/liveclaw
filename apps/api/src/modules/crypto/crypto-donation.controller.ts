import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CryptoDonationService } from './crypto-donation.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { OwnerGuard } from '../../common/owner.guard';

@Controller('crypto/donations')
export class CryptoDonationController {
  constructor(private readonly donationService: CryptoDonationService) {}

  @Post('initiate')
  @UseGuards(JwtAuthGuard)
  async initiateDonation(
    @Body()
    body: {
      agentId: string;
      amount: number;
      network?: string;
      token?: string;
      message?: string;
      streamId?: string;
    },
    @Req() req: any,
  ) {
    const donation = await this.donationService.initiateDonation(
      body.agentId,
      req.user.sub,
      body.amount,
      body.network || 'base',
      body.token || 'ETH',
      body.message,
      body.streamId,
    );

    return {
      donationId: donation.id,
      recipientAddress: donation.recipientAddress,
      network: donation.network,
      token: donation.token,
      amount: donation.amount,
      expiresAt: donation.expiresAt,
    };
  }

  @Patch(':id/tx')
  @UseGuards(JwtAuthGuard)
  async submitTxHash(
    @Param('id') id: string,
    @Body() body: { txHash: string; senderAddress?: string },
    @Req() req: any,
  ) {
    return this.donationService.submitTxHash(
      id,
      body.txHash,
      body.senderAddress,
      req.user.sub,
    );
  }

  @Get('agent/:agentId')
  @UseGuards(JwtAuthGuard, OwnerGuard)
  async getByAgent(@Param('agentId') agentId: string) {
    return this.donationService.getByAgent(agentId);
  }

  @Get('agent/:agentId/summary')
  @UseGuards(JwtAuthGuard, OwnerGuard)
  async getSummary(@Param('agentId') agentId: string) {
    return this.donationService.getSummary(agentId);
  }

  @Get('stream/:streamId')
  async getByStream(@Param('streamId') streamId: string) {
    return this.donationService.getByStream(streamId);
  }
}
