import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixStreamCategoryIdType1710000000009 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE streams ALTER COLUMN category_id TYPE uuid USING category_id::uuid`,
    );
    await queryRunner.query(
      `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_streams_category') THEN
          ALTER TABLE streams ADD CONSTRAINT fk_streams_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL;
        END IF;
      END $$`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE streams DROP CONSTRAINT IF EXISTS fk_streams_category`,
    );
    await queryRunner.query(
      `ALTER TABLE streams ALTER COLUMN category_id TYPE character varying`,
    );
  }
}
