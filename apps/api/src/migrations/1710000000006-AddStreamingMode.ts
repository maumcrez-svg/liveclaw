import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStreamingMode1710000000006 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "streaming_mode" VARCHAR NOT NULL DEFAULT 'native'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "agents" DROP COLUMN IF EXISTS "streaming_mode"`,
    );
  }
}
