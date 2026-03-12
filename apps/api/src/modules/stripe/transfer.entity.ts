import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { UserEntity } from '../users/user.entity';
import { AgentEntity } from '../agents/agent.entity';

@Entity('transfers')
export class TransferEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @Column({ name: 'agent_id' })
  agentId: string;

  @ManyToOne(() => AgentEntity)
  @JoinColumn({ name: 'agent_id' })
  agent: AgentEntity;

  @Column({ name: 'source_type' })
  sourceType: string; // 'donation' or 'subscription'

  @Column({ name: 'source_id', type: 'uuid' })
  sourceId: string;

  @Column({ name: 'gross_amount', type: 'decimal', precision: 10, scale: 2 })
  grossAmount: number;

  @Column({ name: 'platform_fee', type: 'decimal', precision: 10, scale: 2 })
  platformFee: number;

  @Column({ name: 'creator_amount', type: 'decimal', precision: 10, scale: 2 })
  creatorAmount: number;

  @Column({ name: 'stripe_transfer_id', type: 'varchar', nullable: true, unique: true })
  stripeTransferId: string | null;

  @Column({ default: 'pending' })
  status: string; // pending, completed, failed

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
