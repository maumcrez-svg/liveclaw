import { MigrationInterface, QueryRunner } from 'typeorm';

export class AdminPanel1710000000008 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // User ban fields
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "is_banned" BOOLEAN NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "banned_at" TIMESTAMP`,
    );

    // Indexes for admin queries
    await queryRunner.query(
      `CREATE INDEX "IDX_users_role" ON "users" ("role")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_users_is_banned" ON "users" ("is_banned")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_users_created_at" ON "users" ("created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_donations_created_at" ON "donations" ("created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_subscriptions_created_at" ON "subscriptions" ("created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_streams_started_at" ON "streams" ("started_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_streams_is_live" ON "streams" ("is_live")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_streams_is_live"`);
    await queryRunner.query(`DROP INDEX "IDX_streams_started_at"`);
    await queryRunner.query(`DROP INDEX "IDX_subscriptions_created_at"`);
    await queryRunner.query(`DROP INDEX "IDX_donations_created_at"`);
    await queryRunner.query(`DROP INDEX "IDX_users_created_at"`);
    await queryRunner.query(`DROP INDEX "IDX_users_is_banned"`);
    await queryRunner.query(`DROP INDEX "IDX_users_role"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "banned_at"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "is_banned"`);
  }
}
