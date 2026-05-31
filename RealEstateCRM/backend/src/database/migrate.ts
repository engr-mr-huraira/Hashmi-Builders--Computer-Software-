import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'realestate_crm',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function migrate() {
  try {
    // 1. Run base schema.sql (creates tables if they don't exist)
    const schemaPath = path.resolve(__dirname, '../../database/schema.sql');
    const fallbackPath = path.resolve(process.cwd(), 'database/schema.sql');
    const sql = fs.readFileSync(fs.existsSync(schemaPath) ? schemaPath : fallbackPath, 'utf8');
    await pool.query(sql);
    console.log('Base schema applied successfully.');

    // 2. Run numbered migration files in order to patch existing tables
    const migrationsDir = path.resolve(__dirname, '../../database/migrations');
    const fallbackMigrationsDir = path.resolve(process.cwd(), 'database/migrations');
    const mDir = fs.existsSync(migrationsDir) ? migrationsDir : fallbackMigrationsDir;

    if (fs.existsSync(mDir)) {
      const files = fs
        .readdirSync(mDir)
        .filter((f) => f.endsWith('.sql'))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

      for (const file of files) {
        const filePath = path.join(mDir, file);
        const migrationSql = fs.readFileSync(filePath, 'utf8');
        await pool.query(migrationSql);
        console.log(`Migration applied: ${file}`);
      }
    }

    console.log('Database migration completed successfully.');
  } catch (error) {
    console.error('Database migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
