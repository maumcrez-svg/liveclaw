import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { UserEntity } from '../users/user.entity';
import { AgentEntity } from '../agents/agent.entity';

@Entity('follows')
@Unique(['userId', 'agentId'])
export class FollowEntity {
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

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
