import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { StreamEntity } from '../streams/stream.entity';
import { UserEntity } from '../users/user.entity';
import { CategoryEntity } from '../categories/category.entity';

@Entity('agents')
export class AgentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  slug: string;

  @Column()
  name: string;

  @Column({ type: 'text', default: '' })
  description: string;

  @Column({ name: 'avatar_url', type: 'varchar', nullable: true })
  avatarUrl: string | null;

  @Column({ name: 'banner_url', type: 'varchar', nullable: true })
  bannerUrl: string | null;

  @Column({ name: 'agent_type', default: 'custom' })
  agentType: string;

  @Column({ type: 'jsonb', default: {} })
  config: Record<string, unknown>;

  @Column({ name: 'stream_key', unique: true })
  streamKey: string;

  @Column({ name: 'container_id', type: 'varchar', nullable: true })
  containerId: string | null;

  @Column({ name: 'streaming_mode', default: 'native' })
  streamingMode: 'native' | 'external';

  @Column({ default: 'offline' })
  status: string;

  @Column({ name: 'follower_count', default: 0 })
  followerCount: number;

  @Column({ name: 'subscriber_count', default: 0 })
  subscriberCount: number;

  @Column({ name: 'welcome_message', type: 'text', nullable: true })
  welcomeMessage: string | null;

  @Column({ name: 'donation_wallet_address', type: 'varchar', nullable: true })
  donationWalletAddress: string | null;

  @Column({ name: 'default_tags', type: 'text', array: true, default: '{}' })
  defaultTags: string[];

  @Column({ type: 'text', nullable: true })
  instructions: string | null;

  @Column({ name: 'external_links', type: 'jsonb', default: '{}' })
  externalLinks: Record<string, string>;

  // Owner: the user who created / controls this agent
  @Column({ name: 'owner_id', type: 'uuid', nullable: true })
  ownerId: string | null;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'owner_id' })
  owner: UserEntity;

  // Default category surfaced on the browse page when not actively streaming
  @Column({ name: 'default_category_id', type: 'uuid', nullable: true })
  defaultCategoryId: string | null;

  @ManyToOne(() => CategoryEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'default_category_id' })
  defaultCategory: CategoryEntity;

  @OneToMany(() => StreamEntity, (stream) => stream.agent)
  streams: StreamEntity[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
