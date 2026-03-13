import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { RegisterDto, LoginDto } from './auth.dto';
import { UserEntity } from '../users/user.entity';

export interface JwtPayload {
  sub: string;
  username: string;
  role: string;
}

export interface AuthResponse {
  access_token: string;
  user: {
    id: string;
    username: string;
    role: string;
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const existing = await this.usersService.findByUsername(dto.username);
    if (existing) {
      throw new ConflictException('Username is already taken');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.usersService.createWithPassword(
      dto.username,
      passwordHash,
      'viewer',
    );

    return this.buildAuthResponse(user);
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.usersService.findByUsername(dto.username);

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

    return this.buildAuthResponse(user);
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
    return this.buildAuthResponse(updated);
  }

  private buildAuthResponse(user: UserEntity): AuthResponse {
    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      role: user.role,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    };
  }
}
