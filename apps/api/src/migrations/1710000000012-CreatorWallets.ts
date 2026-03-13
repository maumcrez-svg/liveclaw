import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatorWallets1710000000012 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "creator_wallets" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "agent_id" UUID NOT NULL REFERENCES "agents"("id") ON DELETE CASCADE,
        "network" VARCHAR NOT NULL DEFAULT 'base',
        "address" VARCHAR NOT NULL,
        "is_primary" BOOLEAN NOT NULL DEFAULT true,
        "verified_at" TIMESTAMP,
        "created_at" TIMESTAMP DEFAULT NOW(),
        "updated_at" TIMESTAMP DEFAULT NOW(),
        UNIQUE("agent_id", "network")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_creator_wallets_agent" ON "creator_wallets" ("agent_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_creator_wallets_user" ON "creator_wallets" ("user_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_creator_wallets_user"`);
    await queryRunner.query(`DROP INDEX "IDX_creator_wallets_agent"`);
    await queryRunner.query(`DROP TABLE "creator_wallets"`);
  }
}
