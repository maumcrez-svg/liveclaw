import {
  Controller,
  Get,
  Patch,
  Body,
  Query,
  Param,
  UseGuards,
  DefaultValuePipe,
  ParseIntPipe,
  ParseBoolPipe,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ── Users ──

  @Get('users')
  getUsers(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('role') role?: string,
    @Query('banned') banned?: string,
    @Query('sort') sort?: string,
  ) {
    return this.adminService.getUsers({
      page: Math.max(1, page),
      limit: Math.min(100, Math.max(1, limit)),
      role: role && ['viewer', 'creator', 'admin'].includes(role) ? role : undefined,
      banned: banned === 'true' ? true : banned === 'false' ? false : undefined,
      sort,
    });
  }

  @Get('users/search')
  searchUsers(
    @Query('q') query: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    if (!query || query.trim().length === 0) {
      return { data: [], meta: { total: 0, page: 1, limit, totalPages: 0 } };
    }
    return this.adminService.searchUsers(
      query.trim(),
      Math.max(1, page),
      Math.min(100, Math.max(1, limit)),
    );
  }

  @Patch('users/:id/ban')
  banUser(@Param('id') id: string) {
    return this.adminService.banUser(id);
  }

  @Patch('users/:id/unban')
  unbanUser(@Param('id') id: string) {
    return this.adminService.unbanUser(id);
  }

  @Patch('users/:id/role')
  changeUserRole(
    @Param('id') id: string,
    @Body('role') role: string,
  ) {
    return this.adminService.changeUserRole(id, role);
  }

  // ── Global Stats ──

  @Get('stats')
  getGlobalStats() {
    return this.adminService.getGlobalStats();
  }

  // ── Donations ──

  @Get('donations')
  getDonations(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('agentId') agentId?: string,
    @Query('userId') userId?: string,
    @Query('sort') sort?: string,
  ) {
    return this.adminService.getDonations({
      page: Math.max(1, page),
      limit: Math.min(100, Math.max(1, limit)),
      agentId,
      userId,
      sort,
    });
  }

  // ── Subscriptions ──

  @Get('subscriptions')
  getSubscriptions(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('agentId') agentId?: string,
    @Query('userId') userId?: string,
    @Query('active') active?: string,
    @Query('tier') tier?: string,
    @Query('sort') sort?: string,
  ) {
    return this.adminService.getSubscriptions({
      page: Math.max(1, page),
      limit: Math.min(100, Math.max(1, limit)),
      agentId,
      userId,
      active: active === 'true' ? true : active === 'false' ? false : undefined,
      tier: tier && ['tier_1', 'tier_2', 'tier_3'].includes(tier) ? tier : undefined,
      sort,
    });
  }

  // ── Streams ──

  @Get('streams')
  getStreams(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('live') live?: string,
    @Query('agentId') agentId?: string,
    @Query('sort') sort?: string,
  ) {
    return this.adminService.getStreams({
      page: Math.max(1, page),
      limit: Math.min(100, Math.max(1, limit)),
      live: live === 'true' ? true : live === 'false' ? false : undefined,
      agentId,
      sort,
    });
  }
}
