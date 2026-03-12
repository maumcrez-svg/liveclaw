import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Chat Moderation — introduces the chat_bans table used for per-agent
 * user bans and timed timeouts.
 */
export class ChatModeration1710000000003 implements MigrationInterface {
  name = 'ChatModeration1710000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "chat_bans" (
        "id"               UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
        "agent_id"         UUID      NOT NULL REFERENCES "agents"("id") ON DELETE CASCADE,
        "user_id"          UUID      NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "moderator_id"     UUID      NOT NULL REFERENCES "users"("id"),
        "reason"           VARCHAR,
        "type"             VARCHAR   NOT NULL DEFAULT 'ban',
        "duration_seconds" INTEGER,
        "expires_at"       TIMESTAMP,
        "created_at"       TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT "UQ_chat_bans_agent_user" UNIQUE ("agent_id", "user_id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_chat_bans_agent_id" ON "chat_bans" ("agent_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_chat_bans_user_id" ON "chat_bans" ("user_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_chat_bans_user_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_chat_bans_agent_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "chat_bans"`);
  }
}
