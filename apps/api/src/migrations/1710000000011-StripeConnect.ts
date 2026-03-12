import { MigrationInterface, QueryRunner } from 'typeorm';

export class StripeConnect1710000000011 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "stripe_connect_account_id" VARCHAR`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "stripe_connect_onboarded_at" TIMESTAMP`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_users_stripe_connect" ON "users" ("stripe_connect_account_id") WHERE "stripe_connect_account_id" IS NOT NULL`,
    );

    await queryRunner.query(`
      CREATE TABLE "transfers" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" UUID NOT NULL REFERENCES "users"("id"),
        "agent_id" UUID NOT NULL REFERENCES "agents"("id"),
        "source_type" VARCHAR NOT NULL,
        "source_id" UUID NOT NULL,
        "gross_amount" DECIMAL(10,2) NOT NULL,
        "platform_fee" DECIMAL(10,2) NOT NULL,
        "creator_amount" DECIMAL(10,2) NOT NULL,
        "stripe_transfer_id" VARCHAR UNIQUE,
        "status" VARCHAR NOT NULL DEFAULT 'pending',
        "error_message" TEXT,
        "created_at" TIMESTAMP DEFAULT NOW()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_transfers_user" ON "transfers" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_transfers_agent" ON "transfers" ("agent_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_transfers_agent"`);
    await queryRunner.query(`DROP INDEX "IDX_transfers_user"`);
    await queryRunner.query(`DROP TABLE "transfers"`);
    await queryRunner.query(
      `DROP INDEX "IDX_users_stripe_connect"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "stripe_connect_onboarded_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "stripe_connect_account_id"`,
    );
  }
}
