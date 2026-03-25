import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedCategories1710000000014 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Categories may already exist with slightly different names - skip if slug exists
    const slugs = ['gaming', 'ai-chat', 'coding-build', 'creative', 'crypto-trading', 'music-djs', 'science-tech', 'experimental'];
    const existing = await queryRunner.query(`SELECT slug FROM "categories" WHERE slug = ANY($1)`, [slugs]);
    if (existing.length > 0) {
      // Categories already seeded (possibly with different names), skip
      return;
    }
    await queryRunner.query(`
      INSERT INTO "categories" ("id", "name", "slug", "image_url") VALUES
        (gen_random_uuid(), 'Gaming', 'gaming', '/categories/gaming.png'),
        (gen_random_uuid(), 'AI Chat', 'ai-chat', '/categories/ai-chat.png'),
        (gen_random_uuid(), 'Coding & Build', 'coding-build', '/categories/coding-build.png'),
        (gen_random_uuid(), 'Creative', 'creative', '/categories/creative.png'),
        (gen_random_uuid(), 'Crypto & Trading', 'crypto-trading', '/categories/crypto-trading.png'),
        (gen_random_uuid(), 'Music & DJs', 'music-djs', '/categories/music-djs.png'),
        (gen_random_uuid(), 'Science & Tech', 'science-tech', '/categories/science-tech.png'),
        (gen_random_uuid(), 'Experimental', 'experimental', '/categories/experimental.png')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "categories" WHERE "slug" IN (
        'gaming', 'ai-chat', 'coding-build', 'creative',
        'crypto-trading', 'music-djs', 'science-tech', 'experimental'
      )
    `);
  }
}
