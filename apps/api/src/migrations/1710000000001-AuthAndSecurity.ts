import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * AuthAndSecurity — adds authentication fields to users, expands agents with
 * owner/channel metadata, and creates performance indexes on the most
 * frequently-filtered columns.
 */
export class AuthAndSecurity1710000000001 implements MigrationInterface {
  name = 'AuthAndSecurity1710000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ------------------------------------------------------------------
    // users: auth fields
    // ------------------------------------------------------------------
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "password_hash" VARCHAR,
        ADD COLUMN IF NOT EXISTS "role"          VARCHAR NOT NULL DEFAULT 'viewer'
    `);

    // ------------------------------------------------------------------
    // agents: owner + channel metadata
    // ------------------------------------------------------------------
    await queryRunner.query(`
      ALTER TABLE "agents"
        ADD COLUMN IF NOT EXISTS "owner_id"               UUID REFERENCES "users" ("id") ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS "banner_url"             VARCHAR,
        ADD COLUMN IF NOT EXISTS "welcome_message"        TEXT,
        ADD COLUMN IF NOT EXISTS "donation_wallet_address" VARCHAR,
        ADD COLUMN IF NOT EXISTS "instructions"           TEXT,
        ADD COLUMN IF NOT EXISTS "default_tags"           TEXT[] NOT NULL DEFAULT '{}'
    `);

    // ------------------------------------------------------------------
    // Indexes — status and owner lookups are hot paths for the browse page;
    // is_live and agent_id are hit on every stream-list query.
    // ------------------------------------------------------------------
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_agents_status"
        ON "agents" ("status")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_agents_owner_id"
        ON "agents" ("owner_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_streams_is_live"
        ON "streams" ("is_live")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_streams_agent_id"
        ON "streams" ("agent_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_streams_agent_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_streams_is_live"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_agents_owner_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_agents_status"`);

    await queryRunner.query(`
      ALTER TABLE "agents"
        DROP COLUMN IF EXISTS "default_tags",
        DROP COLUMN IF EXISTS "instructions",
        DROP COLUMN IF EXISTS "donation_wallet_address",
        DROP COLUMN IF EXISTS "welcome_message",
        DROP COLUMN IF EXISTS "banner_url",
        DROP COLUMN IF EXISTS "owner_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
        DROP COLUMN IF EXISTS "role",
        DROP COLUMN IF EXISTS "password_hash"
    `);
  }
}
