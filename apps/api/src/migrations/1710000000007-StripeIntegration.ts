import { MigrationInterface, QueryRunner } from 'typeorm';

export class StripeIntegration1710000000007 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Donations: add Stripe columns
    await queryRunner.query(
      `ALTER TABLE "donations" ADD COLUMN "stripe_session_id" VARCHAR UNIQUE`,
    );
    await queryRunner.query(
      `ALTER TABLE "donations" ADD COLUMN "payment_status" VARCHAR NOT NULL DEFAULT 'completed'`,
    );
    await queryRunner.query(
      `ALTER TABLE "donations" ADD COLUMN "paid_at" TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "donations" ALTER COLUMN "stream_id" DROP NOT NULL`,
    );

    // Subscriptions: add Stripe columns
    await queryRunner.query(
      `ALTER TABLE "subscriptions" ADD COLUMN "stripe_customer_id" VARCHAR`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscriptions" ADD COLUMN "stripe_subscription_id" VARCHAR UNIQUE`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscriptions" ADD COLUMN "stripe_price_id" VARCHAR`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscriptions" ADD COLUMN "stripe_session_id" VARCHAR`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscriptions" ADD COLUMN "billing_status" VARCHAR NOT NULL DEFAULT 'active'`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscriptions" ADD COLUMN "current_period_end" TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscriptions" ADD COLUMN "canceled_at" TIMESTAMP`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "subscriptions" DROP COLUMN "canceled_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscriptions" DROP COLUMN "current_period_end"`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscriptions" DROP COLUMN "billing_status"`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscriptions" DROP COLUMN "stripe_session_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscriptions" DROP COLUMN "stripe_price_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscriptions" DROP COLUMN "stripe_subscription_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscriptions" DROP COLUMN "stripe_customer_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "donations" ALTER COLUMN "stream_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "donations" DROP COLUMN "paid_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "donations" DROP COLUMN "payment_status"`,
    );
    await queryRunner.query(
      `ALTER TABLE "donations" DROP COLUMN "stripe_session_id"`,
    );
  }
}
