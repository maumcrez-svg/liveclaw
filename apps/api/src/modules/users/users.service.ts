import { Injectable, NotFoundException } from '@nestjs/common';
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

  async findByUsername(username: string): Promise<UserEntity | null> {
    return this.userRepo.findOne({ where: { username } });
  }

  async createWithPassword(
    username: string,
    passwordHash: string,
    role = 'viewer',
  ): Promise<UserEntity> {
    const user = this.userRepo.create({ username, passwordHash, role });
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
}
