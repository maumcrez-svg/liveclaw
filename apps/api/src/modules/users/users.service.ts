import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  async findOrCreate(username: string): Promise<UserEntity> {
    let user = await this.userRepo.findOne({ where: { username } });
    if (!user) {
      user = this.userRepo.create({ username });
      user = await this.userRepo.save(user);
    }
    return user;
  }

  async findById(id: string): Promise<UserEntity> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  async findByIdPublic(id: string): Promise<Partial<UserEntity>> {
    const user = await this.userRepo.findOne({
      where: { id },
      select: ['id', 'username', 'role', 'avatarUrl', 'createdAt'],
    });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  async findByUsername(username: string): Promise<UserEntity | null> {
    return this.userRepo.findOne({ where: { username } });
  }

  async findByWalletAddress(address: string): Promise<UserEntity | null> {
    return this.userRepo.findOne({
      where: { walletAddress: address.toLowerCase() },
    });
  }

  async createWithPassword(
    username: string,
    passwordHash: string,
    role = 'viewer',
  ): Promise<UserEntity> {
    const user = this.userRepo.create({ username, passwordHash, role });
    return this.userRepo.save(user);
  }

  async createWithWallet(
    username: string,
    walletAddress: string,
    role = 'viewer',
  ): Promise<UserEntity> {
    const user = this.userRepo.create({
      username,
      walletAddress: walletAddress.toLowerCase(),
      role,
    });
    return this.userRepo.save(user);
  }

  async updateProfile(
    userId: string,
    dto: { username?: string; avatarUrl?: string | null },
  ): Promise<UserEntity> {
    const user = await this.findById(userId);

    if (dto.username && dto.username !== user.username) {
      const existing = await this.findByUsername(dto.username);
      if (existing) {
        throw new ConflictException('Username is already taken');
      }
      user.username = dto.username;
    }

    if (dto.avatarUrl !== undefined) {
      user.avatarUrl = dto.avatarUrl;
    }

    return this.userRepo.save(user);
  }

  async updateRole(
    id: string,
    role: 'viewer' | 'creator' | 'admin',
  ): Promise<UserEntity> {
    const user = await this.findById(id);
    user.role = role;
    return this.userRepo.save(user);
  }

  async save(user: UserEntity): Promise<UserEntity> {
    return this.userRepo.save(user);
  }

}
