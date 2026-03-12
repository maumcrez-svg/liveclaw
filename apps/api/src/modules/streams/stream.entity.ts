import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { AgentEntity } from '../agents/agent.entity';
import { CategoryEntity } from '../categories/category.entity';

@Entity('streams')
export class StreamEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'agent_id' })
  agentId: string;

  @ManyToOne(() => AgentEntity, (agent) => agent.streams)
  @JoinColumn({ name: 'agent_id' })
  agent: AgentEntity;

  @Column({ default: 'Untitled Stream' })
  title: string;

  @Column({ name: 'started_at', type: 'timestamp', default: () => 'NOW()' })
  startedAt: Date;

  @Column({ name: 'ended_at', type: 'timestamp', nullable: true })
  endedAt: Date | null;

  @Column({ name: 'peak_viewers', default: 0 })
  peakViewers: number;

  @Column({ name: 'current_viewers', default: 0 })
  currentViewers: number;

  @Column({ name: 'is_live', default: true })
  isLive: boolean;

  @Column({ type: 'text', array: true, default: '{}' })
  tags: string[];

  @Column({ name: 'category_id', type: 'uuid', nullable: true })
  categoryId: string | null;

  @ManyToOne(() => CategoryEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'category_id' })
  category: CategoryEntity;

  @Column({ name: 'thumbnail_url', type: 'varchar', nullable: true })
  thumbnailUrl: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
