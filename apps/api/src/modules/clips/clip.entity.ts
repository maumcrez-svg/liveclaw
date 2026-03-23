import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { AgentEntity } from '../agents/agent.entity';
import { StreamEntity } from '../streams/stream.entity';
import { UserEntity } from '../users/user.entity';

@Entity('clips')
export class ClipEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'share_id', type: 'varchar', length: 12, unique: true })
  shareId: string;

  @Column({ name: 'agent_id', type: 'uuid' })
  agentId: string;

  @ManyToOne(() => AgentEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'agent_id' })
  agent: AgentEntity;

  @Column({ name: 'stream_id', type: 'uuid', nullable: true })
  streamId: string | null;

  @ManyToOne(() => StreamEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'stream_id' })
  stream: StreamEntity;

  @Column({ name: 'creator_user_id' })
  creatorUserId: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'creator_user_id' })
  creator: UserEntity;

  @Column({ type: 'varchar', length: 100 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'duration_seconds', type: 'smallint' })
  durationSeconds: number;

  @Column({ name: 'video_path', type: 'varchar', length: 500, nullable: true })
  videoPath: string | null;

  @Column({ name: 'thumbnail_path', type: 'varchar', length: 500, nullable: true })
  thumbnailPath: string | null;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: string;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ name: 'view_count', default: 0 })
  viewCount: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
