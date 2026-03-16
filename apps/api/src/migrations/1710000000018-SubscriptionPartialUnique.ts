import { MigrationInterface, QueryRunner } from 'typeorm';

export class SubscriptionPartialUnique1710000000018
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop the old full unique constraint that blocks re-subscription after expiry
    await queryRunner.query(
      `ALTER TABLE "subscriptions" DROP CONSTRAINT IF EXISTS "UQ_subscriptions_user_agent"`,
    );

    // Create a partial unique index: only one active subscription per user+agent
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_subscriptions_active_user_agent"
       ON "subscriptions" ("user_id", "agent_id")
       WHERE "is_active" = true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_subscriptions_active_user_agent"`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscriptions" ADD CONSTRAINT "UQ_subscriptions_user_agent" UNIQUE ("user_id", "agent_id")`,
    );
  }
}
