import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAgentApiKeyAndHeartbeat1710000000010 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "agents" ADD COLUMN "api_key_hash" VARCHAR`,
    );
    await queryRunner.query(
      `ALTER TABLE "agents" ADD COLUMN "api_key_sha256" VARCHAR(64) UNIQUE`,
    );
    await queryRunner.query(
      `ALTER TABLE "agents" ADD COLUMN "last_heartbeat_at" TIMESTAMP`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_agents_api_key_sha256" ON "agents" ("api_key_sha256")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_agents_api_key_sha256"`,
    );
    await queryRunner.query(
      `ALTER TABLE "agents" DROP COLUMN IF EXISTS "last_heartbeat_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "agents" DROP COLUMN IF EXISTS "api_key_sha256"`,
    );
    await queryRunner.query(
      `ALTER TABLE "agents" DROP COLUMN IF EXISTS "api_key_hash"`,
    );
  }
}
