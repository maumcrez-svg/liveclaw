import {
  Controller,
  Get,
  Param,
  UseGuards,
} from '@nestjs/common';
import { DonationsService } from './donations.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { OwnerGuard } from '../../common/owner.guard';

@Controller('donations')
export class DonationsController {
  constructor(
    private readonly donationsService: DonationsService,
  ) {}

  @Get('stream/:streamId')
  getStreamDonations(@Param('streamId') streamId: string) {
    return this.donationsService.getStreamDonations(streamId);
  }

  @Get('agent/:agentId/stats')
  @UseGuards(JwtAuthGuard, OwnerGuard)
  getDonationStats(@Param('agentId') agentId: string) {
    return this.donationsService.getDonationStats(agentId);
  }
}
