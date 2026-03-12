import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Categories — introduces a first-class categories table and links it to
 * agents via an optional default_category_id foreign key.  Streams already
 * have a category_id VARCHAR column (from InitialSchema) that can be
 * cross-referenced once a CategoryEntity is added to the codebase.
 */
export class Categories1710000000002 implements MigrationInterface {
  name = 'Categories1710000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ------------------------------------------------------------------
    // categories
    // ------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "categories" (
        "id"         UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
        "name"       VARCHAR   NOT NULL,
        "slug"       VARCHAR   NOT NULL,
        "icon_url"   VARCHAR,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_categories_name" UNIQUE ("name"),
        CONSTRAINT "UQ_categories_slug" UNIQUE ("slug")
      )
    `);

    // ------------------------------------------------------------------
    // agents: optional default category
    // ------------------------------------------------------------------
    await queryRunner.query(`
      ALTER TABLE "agents"
        ADD COLUMN IF NOT EXISTS "default_category_id"
          UUID REFERENCES "categories" ("id") ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "agents"
        DROP COLUMN IF EXISTS "default_category_id"
    `);

    await queryRunner.query(`DROP TABLE IF EXISTS "categories"`);
  }
}
