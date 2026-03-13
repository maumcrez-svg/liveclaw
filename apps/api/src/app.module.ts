import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AgentsModule } from './modules/agents/agents.module';
import { StreamsModule } from './modules/streams/streams.module';
import { ChatModule } from './modules/chat/chat.module';
import { RuntimeModule } from './modules/runtime/runtime.module';
import { UsersModule } from './modules/users/users.module';
import { FollowsModule } from './modules/follows/follows.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { DonationsModule } from './modules/donations/donations.module';
import { EmotesModule } from './modules/emotes/emotes.module';
import { AuthModule } from './modules/auth/auth.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { HealthModule } from './modules/health/health.module';
import { CommonModule } from './common/common.module';
import { ModerationModule } from './modules/chat/moderation/moderation.module';
import { StripeModule } from './modules/stripe/stripe.module';
import { AdminModule } from './modules/admin/admin.module';
import { CryptoModule } from './modules/crypto/crypto.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DATABASE_HOST', 'localhost'),
        port: config.get<number>('DATABASE_PORT', 5432),
        username: config.get('DATABASE_USER', 'liveclaw'),
        password: config.getOrThrow('DATABASE_PASSWORD'),
        database: config.get('DATABASE_NAME', 'liveclaw'),
        autoLoadEntities: true,
        synchronize: false,
        migrations: [__dirname + '/migrations/*{.ts,.js}'],
      }),
    }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'thumbnails'),
      serveRoot: '/thumbnails',
    }),
    AgentsModule,
    StreamsModule,
    ChatModule,
    RuntimeModule,
    UsersModule,
    FollowsModule,
    SubscriptionsModule,
    DonationsModule,
    EmotesModule,
    AuthModule,
    CategoriesModule,
    HealthModule,
    CommonModule,
    ModerationModule,
    StripeModule,
    AdminModule,
    CryptoModule,
  ],
})
export class AppModule {}
