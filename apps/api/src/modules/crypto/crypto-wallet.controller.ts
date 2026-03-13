import {
  Controller,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { CryptoWalletService } from './crypto-wallet.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { OwnerGuard } from '../../common/owner.guard';

@Controller('crypto/wallets')
export class CryptoWalletController {
  constructor(private readonly walletService: CryptoWalletService) {}

  @Put('agent/:agentId')
  @UseGuards(JwtAuthGuard, OwnerGuard)
  async createOrUpdateWallet(
    @Param('agentId') agentId: string,
    @Body() body: { network: string; address: string },
    @Req() req: any,
  ) {
    return this.walletService.createOrUpdateWallet(
      req.user.sub,
      agentId,
      body.network || 'base',
      body.address,
    );
  }

  @Get('agent/:agentId')
  async getWallet(@Param('agentId') agentId: string) {
    const wallet = await this.walletService.getWalletByAgent(agentId);
    if (!wallet) {
      throw new NotFoundException('No wallet configured for this agent');
    }
    return {
      network: wallet.network,
      address: wallet.address,
      verifiedAt: wallet.verifiedAt,
    };
  }

  @Delete('agent/:agentId')
  @UseGuards(JwtAuthGuard, OwnerGuard)
  async deleteWallet(
    @Param('agentId') agentId: string,
    @Req() req: any,
  ) {
    await this.walletService.deleteWalletByAgent(agentId, req.user.sub);
    return { deleted: true };
  }
}
