import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateClips1710000000019 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "clips" (
        "id"                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "share_id"          VARCHAR(12) NOT NULL,
        "agent_id"          UUID NOT NULL,
        "stream_id"         UUID,
        "creator_user_id"   UUID NOT NULL,
        "title"             VARCHAR(100) NOT NULL,
        "description"       TEXT,
        "duration_seconds"  SMALLINT NOT NULL,
        "video_path"        VARCHAR(500),
        "thumbnail_path"    VARCHAR(500),
        "status"            VARCHAR(20) NOT NULL DEFAULT 'pending',
        "error_message"     TEXT,
        "view_count"        INTEGER NOT NULL DEFAULT 0,
        "created_at"        TIMESTAMP NOT NULL DEFAULT NOW(),
        "updated_at"        TIMESTAMP NOT NULL DEFAULT NOW(),

        CONSTRAINT "FK_clips_agent" FOREIGN KEY ("agent_id")
          REFERENCES "agents"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_clips_stream" FOREIGN KEY ("stream_id")
          REFERENCES "streams"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_clips_creator" FOREIGN KEY ("creator_user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_clips_share_id" ON "clips" ("share_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_clips_agent_id" ON "clips" ("agent_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_clips_creator_user_id" ON "clips" ("creator_user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_clips_stream_id" ON "clips" ("stream_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_clips_status" ON "clips" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_clips_created_at" ON "clips" ("created_at" DESC)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "clips"`);
  }
}
