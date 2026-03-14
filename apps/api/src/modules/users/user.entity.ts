import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  username: string;

  @Column({ name: 'password_hash', type: 'varchar', nullable: true })
  passwordHash: string | null;

  @Column({ default: 'viewer' })
  role: string;

  @Column({ name: 'wallet_address', type: 'varchar', nullable: true })
  walletAddress: string | null;

  @Column({ name: 'avatar_url', type: 'varchar', nullable: true })
  avatarUrl: string | null;

  @Column({ name: 'is_banned', default: false })
  isBanned: boolean;

  @Column({ name: 'banned_at', type: 'timestamp', nullable: true })
  bannedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
