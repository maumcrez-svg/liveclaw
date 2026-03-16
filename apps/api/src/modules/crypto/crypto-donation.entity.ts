import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { AgentEntity } from '../agents/agent.entity';
import { UserEntity } from '../users/user.entity';
import { StreamEntity } from '../streams/stream.entity';

export type CryptoDonationStatus =
  | 'initiated'
  | 'pending'
  | 'confirming'
  | 'confirmed'
  | 'failed'
  | 'expired';

@Entity('crypto_donations')
export class CryptoDonationEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'agent_id' })
  agentId: string;

  @ManyToOne(() => AgentEntity)
  @JoinColumn({ name: 'agent_id' })
  agent: AgentEntity;

  @Column({ name: 'stream_id', type: 'uuid', nullable: true })
  streamId: string | null;

  @ManyToOne(() => StreamEntity, { nullable: true })
  @JoinColumn({ name: 'stream_id' })
  stream: StreamEntity;

  @Column({ name: 'viewer_user_id', type: 'uuid', nullable: true })
  viewerUserId: string | null;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'viewer_user_id' })
  viewerUser: UserEntity;

  @Column({ default: 'base' })
  network: string;

  @Column({ default: 'ETH' })
  token: string;

  @Column({ type: 'decimal', precision: 20, scale: 9 })
  amount: number;

  @Column({ name: 'amount_usd', type: 'decimal', precision: 10, scale: 2, nullable: true })
  amountUsd: number | null;

  @Column({ name: 'recipient_address' })
  recipientAddress: string;

  @Column({ name: 'sender_address', type: 'varchar', nullable: true })
  senderAddress: string | null;

  @Column({ name: 'tx_hash', type: 'varchar', unique: true, nullable: true })
  txHash: string | null;

  @Column({ type: 'text', nullable: true })
  message: string | null;

  @Column({ default: 'initiated' })
  status: CryptoDonationStatus;

  @Column({ name: 'verified_on_chain', default: false })
  verifiedOnChain: boolean;

  @Column({ name: 'block_number', type: 'bigint', nullable: true })
  blockNumber: string | null;

  @Column({ name: 'confirmed_at', type: 'timestamp', nullable: true })
  confirmedAt: Date | null;

  @Column({ name: 'expires_at', type: 'timestamp', nullable: true })
  expiresAt: Date | null;

  @Column({ default: 'donation' })
  type: 'donation' | 'subscription';

  @Column({ name: 'subscription_id', type: 'uuid', nullable: true })
  subscriptionId: string | null;

  @Column({ type: 'varchar', nullable: true })
  tier: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
