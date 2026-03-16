import { MigrationInterface, QueryRunner } from 'typeorm';

export class CryptoSubscriptions1710000000015 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "crypto_donations" ADD COLUMN IF NOT EXISTS "type" varchar NOT NULL DEFAULT 'donation'`,
    );
    await queryRunner.query(
      `ALTER TABLE "crypto_donations" ADD COLUMN IF NOT EXISTS "subscription_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "crypto_donations" ADD COLUMN IF NOT EXISTS "tier" varchar`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "crypto_donations" DROP COLUMN IF EXISTS "tier"`,
    );
    await queryRunner.query(
      `ALTER TABLE "crypto_donations" DROP COLUMN IF EXISTS "subscription_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "crypto_donations" DROP COLUMN IF EXISTS "type"`,
    );
  }
}
