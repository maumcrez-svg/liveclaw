import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDonationIdToSubscription1710000000017 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE subscriptions ADD COLUMN donation_id UUID NULL`);
    await queryRunner.query(`CREATE UNIQUE INDEX idx_subscriptions_donation_id ON subscriptions (donation_id) WHERE donation_id IS NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_subscriptions_donation_id`);
    await queryRunner.query(`ALTER TABLE subscriptions DROP COLUMN IF EXISTS donation_id`);
  }
}
