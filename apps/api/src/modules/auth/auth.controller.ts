import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService, AuthResponse } from './auth.service';
import { RegisterDto, LoginDto, WalletLoginDto } from './auth.dto';
import { JwtAuthGuard } from './auth.guard';
import { CurrentUser } from './auth.decorator';
import { JwtPayload } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  async register(
    @Body() dto: RegisterDto,
  ): Promise<AuthResponse> {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async login(
    @Body() dto: LoginDto,
  ): Promise<AuthResponse> {
    return this.authService.login(dto);
  }

  @Get('wallet-nonce')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async walletNonce(): Promise<{ nonce: string; message: string }> {
    return this.authService.generateNonce();
  }

  @Post('wallet-login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async walletLogin(
    @Body() dto: WalletLoginDto,
  ): Promise<AuthResponse> {
    return this.authService.walletLogin(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: JwtPayload): Promise<AuthResponse['user']> {
    return this.authService.getFullUser(user.sub);
  }

  @Post('become-creator')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  async becomeCreator(@CurrentUser() user: JwtPayload): Promise<AuthResponse> {
    return this.authService.becomeCreator(user.sub);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async refreshToken(
    @Body('refresh_token') refreshToken: string,
  ): Promise<AuthResponse> {
    return this.authService.refreshAccessToken(refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  async logout(
    @CurrentUser() user: JwtPayload,
    @Body('refresh_token') refreshToken?: string,
  ): Promise<void> {
    return this.authService.logout(user.sub, refreshToken);
  }
}
