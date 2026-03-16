import { Controller, Get } from '@nestjs/common';
import { PlatformService, PlatformStats } from './platform.service';

@Controller('platform')
export class PlatformController {
  constructor(private readonly platformService: PlatformService) {}

  @Get('stats')
  async getStats(): Promise<PlatformStats> {
    return this.platformService.getStats();
  }
}
