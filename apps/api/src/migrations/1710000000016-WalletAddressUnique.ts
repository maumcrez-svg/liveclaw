import { MigrationInterface, QueryRunner } from 'typeorm';

export class WalletAddressUnique1710000000016 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Ensure wallet_address has a unique index for wallet-connect auth
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_users_wallet_address" ON "users" ("wallet_address") WHERE "wallet_address" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_users_wallet_address"`,
    );
  }
}
