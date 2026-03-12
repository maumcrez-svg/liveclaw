import { Controller, Post, Delete, Get, Param, Query, UseGuards } from '@nestjs/common';
import { RuntimeService } from './runtime.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { OwnerGuard } from '../../common/owner.guard';

@Controller('runtime')
@UseGuards(JwtAuthGuard, OwnerGuard)
export class RuntimeController {
  constructor(private readonly runtimeService: RuntimeService) {}

  @Post(':agentId/start')
  startAgent(@Param('agentId') agentId: string) {
    return this.runtimeService.startAgent(agentId);
  }

  @Delete(':agentId/stop')
  stopAgent(@Param('agentId') agentId: string) {
    return this.runtimeService.stopAgent(agentId);
  }

  @Post(':agentId/restart')
  restartAgent(@Param('agentId') agentId: string) {
    return this.runtimeService.restartAgent(agentId);
  }

  @Get(':agentId/logs')
  getLogs(@Param('agentId') agentId: string, @Query('tail') tail?: string) {
    return this.runtimeService.getAgentLogs(agentId, tail ? parseInt(tail, 10) : 100);
  }
}
