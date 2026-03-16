import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { verifyMessage } from 'ethers';
import { v4 as uuidv4 } from 'uuid';
import Redis from 'ioredis';
import { UsersService } from '../users/users.service';
import { RegisterDto, LoginDto, WalletLoginDto } from './auth.dto';
import { UserEntity } from '../users/user.entity';
import { REDIS_CLIENT } from '../../common/redis.provider';
import { RefreshTokenService } from './refresh-token.service';

export interface JwtPayload {
  sub: string;
  username: string;
  role: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: {
    id: string;
    username: string;
    role: string;
    avatarUrl: string | null;
    walletAddress: string | null;
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly refreshTokenService: RefreshTokenService,
  ) {}

  async generateNonce(): Promise<{ nonce: string; message: string }> {
    const nonce = uuidv4();
    await this.redis.set(`nonce:${nonce}`, '1', 'EX', 300, 'NX');
    const message = `Sign in to LiveClaw\nNonce: ${nonce}`;
    return { nonce, message };
  }

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const normalizedUsername = dto.username.toLowerCase();
    const existing = await this.usersService.findByUsername(normalizedUsername);
    if (existing) {
      throw new ConflictException('Username is already taken');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.usersService.createWithPassword(
      normalizedUsername,
      passwordHash,
      'viewer',
    );

    return await this.buildAuthResponse(user);
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.usersService.findByUsername(dto.username.toLowerCase());

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.isBanned) {
      throw new UnauthorizedException('Your account has been suspended');
    }

    return await this.buildAuthResponse(user);
  }

  async walletLogin(dto: WalletLoginDto): Promise<AuthResponse> {
    // Verify the message contains a valid nonce
    const nonceMatch = dto.message.match(/Nonce: (.+)$/);
    if (!nonceMatch) {
      throw new BadRequestException('Invalid message format');
    }

    const nonce = nonceMatch[1];
    const existed = await this.redis.getdel(`nonce:${nonce}`);
    if (!existed) {
      throw new BadRequestException('Invalid or expired nonce');
    }

    // Verify signature
    let recoveredAddress: string;
    try {
      recoveredAddress = verifyMessage(dto.message, dto.signature);
    } catch {
      throw new UnauthorizedException('Invalid signature');
    }

    if (recoveredAddress.toLowerCase() !== dto.address.toLowerCase()) {
      throw new UnauthorizedException('Signature does not match address');
    }

    // Find or create user
    let user = await this.usersService.findByWalletAddress(dto.address);

    if (user) {
      if (user.isBanned) {
        throw new UnauthorizedException('Your account has been suspended');
      }
      return await this.buildAuthResponse(user);
    }

    // Auto-create user with address-derived username
    const shortAddr = `${dto.address.slice(0, 6)}...${dto.address.slice(-4)}`;
    // Generate a unique username from the address
    const baseUsername = `0x${dto.address.slice(2, 6)}_${dto.address.slice(-4)}`;
    let username = baseUsername;
    let attempt = 0;
    while (await this.usersService.findByUsername(username)) {
      attempt++;
      username = `${baseUsername}_${attempt}`;
    }

    user = await this.usersService.createWithWallet(username, dto.address, 'viewer');
    return await this.buildAuthResponse(user);
  }

  async validateUser(userId: string): Promise<UserEntity> {
    return this.usersService.findById(userId);
  }

  async becomeCreator(userId: string): Promise<AuthResponse> {
    const user = await this.usersService.findById(userId);

    if (user.isBanned) {
      throw new UnauthorizedException('Your account has been suspended');
    }

    if (user.role === 'admin') {
      throw new BadRequestException('Admins already have full access.');
    }

    if (user.role === 'creator') {
      throw new BadRequestException('You are already a creator.');
    }

    const updated = await this.usersService.updateRole(user.id, 'creator');
    return await this.buildAuthResponse(updated);
  }

  async getFullUser(userId: string): Promise<AuthResponse['user']> {
    const user = await this.usersService.findById(userId);
    return {
      id: user.id,
      username: user.username,
      role: user.role,
      avatarUrl: user.avatarUrl,
      walletAddress: user.walletAddress,
    };
  }

  async buildAuthResponse(user: UserEntity): Promise<AuthResponse> {
    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      role: user.role,
    };

    const refreshToken = await this.refreshTokenService.generateRefreshToken(user.id);

    return {
      access_token: this.jwtService.sign(payload),
      refresh_token: refreshToken,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        avatarUrl: user.avatarUrl,
        walletAddress: user.walletAddress,
      },
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<AuthResponse> {
    const userId = await this.refreshTokenService.consumeRefreshToken(refreshToken);
    if (!userId) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    const user = await this.usersService.findById(userId);
    if (user.isBanned) {
      throw new UnauthorizedException('Your account has been suspended');
    }
    return this.buildAuthResponse(user);
  }

  async logout(userId: string, refreshToken?: string): Promise<void> {
    if (refreshToken) {
      await this.refreshTokenService.consumeRefreshToken(refreshToken);
    }
  }
}
