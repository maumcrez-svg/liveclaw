import { MigrationInterface, QueryRunner } from 'typeorm';

export class CryptoDonations1710000000013 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "crypto_donations" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "agent_id" UUID NOT NULL REFERENCES "agents"("id"),
        "stream_id" UUID REFERENCES "streams"("id"),
        "viewer_user_id" UUID REFERENCES "users"("id"),
        "network" VARCHAR NOT NULL DEFAULT 'base',
        "token" VARCHAR NOT NULL DEFAULT 'ETH',
        "amount" DECIMAL(20,9) NOT NULL,
        "amount_usd" DECIMAL(10,2),
        "recipient_address" VARCHAR NOT NULL,
        "sender_address" VARCHAR,
        "tx_hash" VARCHAR UNIQUE,
        "message" TEXT,
        "status" VARCHAR NOT NULL DEFAULT 'initiated',
        "verified_on_chain" BOOLEAN DEFAULT false,
        "block_number" BIGINT,
        "confirmed_at" TIMESTAMP,
        "expires_at" TIMESTAMP,
        "created_at" TIMESTAMP DEFAULT NOW()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_crypto_donations_agent" ON "crypto_donations" ("agent_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_crypto_donations_stream" ON "crypto_donations" ("stream_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_crypto_donations_status" ON "crypto_donations" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_crypto_donations_tx" ON "crypto_donations" ("tx_hash") WHERE "tx_hash" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_crypto_donations_tx"`);
    await queryRunner.query(`DROP INDEX "IDX_crypto_donations_status"`);
    await queryRunner.query(`DROP INDEX "IDX_crypto_donations_stream"`);
    await queryRunner.query(`DROP INDEX "IDX_crypto_donations_agent"`);
    await queryRunner.query(`DROP TABLE "crypto_donations"`);
  }
}
