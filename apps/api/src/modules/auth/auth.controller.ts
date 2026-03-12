import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService, AuthResponse } from './auth.service';
import { RegisterDto, LoginDto } from './auth.dto';
import { JwtAuthGuard } from './auth.guard';
import { CurrentUser } from './auth.decorator';
import { JwtPayload } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  async register(
    @Body(new ValidationPipe({ whitelist: true })) dto: RegisterDto,
  ): Promise<AuthResponse> {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async login(
    @Body(new ValidationPipe({ whitelist: true })) dto: LoginDto,
  ): Promise<AuthResponse> {
    return this.authService.login(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: JwtPayload): Promise<JwtPayload> {
    // Return the full user record so callers get fresh data if needed.
    // The payload already has sub/username/role from the token, which is
    // sufficient for most clients. A DB fetch would add latency with no gain
    // here since tokens expire in 7d and roles rarely change.
    return user;
  }

  @Post('become-creator')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  async becomeCreator(@CurrentUser() user: JwtPayload): Promise<AuthResponse> {
    return this.authService.becomeCreator(user.sub);
  }
}
