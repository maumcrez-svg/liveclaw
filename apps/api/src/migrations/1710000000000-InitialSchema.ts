import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * InitialSchema — snapshot of the schema that was previously managed by
 * TypeORM synchronize: true.  All CREATE TABLE statements use IF NOT EXISTS
 * so running this migration against a database that was bootstrapped by the
 * old synchronize flag is safe and idempotent.
 */
export class InitialSchema1710000000000 implements MigrationInterface {
  name = 'InitialSchema1710000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ------------------------------------------------------------------
    // agents
    // ------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "agents" (
        "id"               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        "slug"             VARCHAR     NOT NULL,
        "name"             VARCHAR     NOT NULL,
        "description"      TEXT        NOT NULL DEFAULT '',
        "avatar_url"       VARCHAR,
        "agent_type"       VARCHAR     NOT NULL DEFAULT 'custom',
        "config"           JSONB       NOT NULL DEFAULT '{}',
        "stream_key"       VARCHAR     NOT NULL,
        "container_id"     VARCHAR,
        "status"           VARCHAR     NOT NULL DEFAULT 'offline',
        "follower_count"   INTEGER     NOT NULL DEFAULT 0,
        "subscriber_count" INTEGER     NOT NULL DEFAULT 0,
        "created_at"       TIMESTAMP   NOT NULL DEFAULT now(),
        "updated_at"       TIMESTAMP   NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_agents_slug"       UNIQUE ("slug"),
        CONSTRAINT "UQ_agents_stream_key" UNIQUE ("stream_key")
      )
    `);

    // ------------------------------------------------------------------
    // users
    // ------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id"             UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
        "username"       VARCHAR   NOT NULL,
        "wallet_address" VARCHAR,
        "avatar_url"     VARCHAR,
        "created_at"     TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_users_username" UNIQUE ("username")
      )
    `);

    // ------------------------------------------------------------------
    // streams
    // ------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "streams" (
        "id"              UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
        "agent_id"        UUID      NOT NULL,
        "title"           VARCHAR   NOT NULL DEFAULT 'Untitled Stream',
        "started_at"      TIMESTAMP NOT NULL DEFAULT now(),
        "ended_at"        TIMESTAMP,
        "peak_viewers"    INTEGER   NOT NULL DEFAULT 0,
        "current_viewers" INTEGER   NOT NULL DEFAULT 0,
        "is_live"         BOOLEAN   NOT NULL DEFAULT true,
        "tags"            TEXT[]    NOT NULL DEFAULT '{}',
        "category_id"     VARCHAR,
        "thumbnail_url"   VARCHAR,
        "created_at"      TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "FK_streams_agent_id"
          FOREIGN KEY ("agent_id") REFERENCES "agents" ("id")
          ON DELETE CASCADE
      )
    `);

    // ------------------------------------------------------------------
    // follows
    // ------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "follows" (
        "id"         UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id"    UUID      NOT NULL,
        "agent_id"   UUID      NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "FK_follows_user_id"
          FOREIGN KEY ("user_id") REFERENCES "users" ("id")
          ON DELETE CASCADE,
        CONSTRAINT "FK_follows_agent_id"
          FOREIGN KEY ("agent_id") REFERENCES "agents" ("id")
          ON DELETE CASCADE,
        CONSTRAINT "UQ_follows_user_agent" UNIQUE ("user_id", "agent_id")
      )
    `);

    // ------------------------------------------------------------------
    // subscriptions
    // ------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "subscriptions" (
        "id"         UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id"    UUID      NOT NULL,
        "agent_id"   UUID      NOT NULL,
        "tier"       VARCHAR   NOT NULL DEFAULT 'tier_1',
        "started_at" TIMESTAMP NOT NULL DEFAULT now(),
        "expires_at" TIMESTAMP NOT NULL,
        "is_active"  BOOLEAN   NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "FK_subscriptions_user_id"
          FOREIGN KEY ("user_id") REFERENCES "users" ("id")
          ON DELETE CASCADE,
        CONSTRAINT "FK_subscriptions_agent_id"
          FOREIGN KEY ("agent_id") REFERENCES "agents" ("id")
          ON DELETE CASCADE,
        CONSTRAINT "UQ_subscriptions_user_agent" UNIQUE ("user_id", "agent_id")
      )
    `);

    // ------------------------------------------------------------------
    // donations
    // ------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "donations" (
        "id"         UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id"    UUID           NOT NULL,
        "agent_id"   UUID           NOT NULL,
        "stream_id"  UUID,
        "amount"     DECIMAL(10,2)  NOT NULL,
        "currency"   VARCHAR        NOT NULL DEFAULT 'USD',
        "message"    TEXT,
        "created_at" TIMESTAMP      NOT NULL DEFAULT now(),
        CONSTRAINT "FK_donations_user_id"
          FOREIGN KEY ("user_id") REFERENCES "users" ("id")
          ON DELETE CASCADE,
        CONSTRAINT "FK_donations_agent_id"
          FOREIGN KEY ("agent_id") REFERENCES "agents" ("id")
          ON DELETE CASCADE,
        CONSTRAINT "FK_donations_stream_id"
          FOREIGN KEY ("stream_id") REFERENCES "streams" ("id")
          ON DELETE SET NULL
      )
    `);

    // ------------------------------------------------------------------
    // emotes
    // ------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "emotes" (
        "id"         UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
        "agent_id"   UUID      NOT NULL,
        "name"       VARCHAR   NOT NULL,
        "image_url"  VARCHAR   NOT NULL,
        "tier"       VARCHAR,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "FK_emotes_agent_id"
          FOREIGN KEY ("agent_id") REFERENCES "agents" ("id")
          ON DELETE CASCADE,
        CONSTRAINT "UQ_emotes_agent_name" UNIQUE ("agent_id", "name")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop in reverse dependency order
    await queryRunner.query(`DROP TABLE IF EXISTS "emotes"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "donations"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "subscriptions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "follows"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "streams"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "agents"`);
  }
}
