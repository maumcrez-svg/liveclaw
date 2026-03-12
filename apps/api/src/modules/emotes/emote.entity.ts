import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { AgentEntity } from '../agents/agent.entity';

@Entity('emotes')
@Unique(['agentId', 'name'])
export class EmoteEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'agent_id' })
  agentId: string;

  @ManyToOne(() => AgentEntity)
  @JoinColumn({ name: 'agent_id' })
  agent: AgentEntity;

  @Column()
  name: string;

  @Column({ name: 'image_url' })
  imageUrl: string;

  @Column({ type: 'varchar', nullable: true })
  tier: string | null; // null = free, 'tier_1'/'tier_2'/'tier_3' = sub-only

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
