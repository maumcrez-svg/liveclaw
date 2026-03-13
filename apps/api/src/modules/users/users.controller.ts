import {
  Controller, Get, Post, Patch, Body, Param, UseGuards, ValidationPipe,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateProfileDto } from './users.dto';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/auth.decorator';
import { JwtPayload, AuthResponse } from '../auth/auth.service';
import { AuthService } from '../auth/auth.service';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
  ) {}

  @Post()
  findOrCreate(@Body() dto: CreateUserDto) {
    return this.usersService.findOrCreate(dto.username);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  async updateProfile(
    @CurrentUser() user: JwtPayload,
    @Body(new ValidationPipe({ whitelist: true })) dto: UpdateProfileDto,
  ): Promise<AuthResponse> {
    const updated = await this.usersService.updateProfile(user.sub, dto);
    return this.authService.buildAuthResponse(updated);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Patch(':id/role')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  updateRole(
    @Param('id') id: string,
    @Body('role') role: 'viewer' | 'creator' | 'admin',
  ) {
    const validRoles = ['viewer', 'creator', 'admin'];
    if (!validRoles.includes(role)) {
      throw new Error(`Invalid role. Must be one of: ${validRoles.join(', ')}`);
    }
    return this.usersService.updateRole(id, role);
  }
}
