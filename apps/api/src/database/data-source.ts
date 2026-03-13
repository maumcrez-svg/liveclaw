import 'reflect-metadata';
import { DataSource } from 'typeorm';

// Load .env for CLI usage (NestJS ConfigModule is not available here)
// dotenv is available transitively through @nestjs/config -> dotenv
// We attempt to load it gracefully so the file also works in compiled JS contexts
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('dotenv').config();
} catch {
  // dotenv not present at runtime — rely on process.env being pre-populated
}

const {
  DATABASE_HOST = 'localhost',
  DATABASE_PORT = '5436',
  DATABASE_USER = 'liveclaw',
  DATABASE_NAME = 'liveclaw',
} = process.env;

const DATABASE_PASSWORD = process.env.DATABASE_PASSWORD;
if (!DATABASE_PASSWORD) {
  throw new Error(
    'DATABASE_PASSWORD environment variable is required. Set it in your .env file or environment.',
  );
}

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: DATABASE_HOST,
  port: parseInt(DATABASE_PORT, 10),
  username: DATABASE_USER,
  password: DATABASE_PASSWORD,
  database: DATABASE_NAME,

  // Entities: glob covers both ts-node (src) and compiled JS (dist) execution
  entities: [
    __dirname + '/../modules/**/*.entity.ts',
    __dirname + '/../modules/**/*.entity.js',
  ],

  // Migrations: same dual-path approach
  migrations: [
    __dirname + '/../migrations/*.ts',
    __dirname + '/../migrations/*.js',
  ],

  synchronize: false,
  migrationsRun: false,
  logging: ['migration', 'error'],
});
