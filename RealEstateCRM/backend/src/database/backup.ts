import { execFile } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

const backupDir = process.env.BACKUP_PATH || path.join(process.cwd(), 'backups');

if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

const filename = `realestate-crm-${new Date().toISOString().replace(/[:.]/g, '-')}.backup`;
const outputPath = path.join(backupDir, filename);

const args = [
  '-h', process.env.DB_HOST || 'localhost',
  '-p', process.env.DB_PORT || '5432',
  '-U', process.env.DB_USER || 'postgres',
  '-F', 'c',
  '-f', outputPath,
  process.env.DB_NAME || 'realestate_crm',
];

const child = execFile('pg_dump', args, {
  env: { ...process.env, PGPASSWORD: process.env.DB_PASSWORD || 'postgres' },
}, (error) => {
  if (error) {
    console.error('Backup failed:', error.message);
    process.exit(1);
  }
  console.log(`Backup created: ${outputPath}`);
});

child.stdout?.pipe(process.stdout);
child.stderr?.pipe(process.stderr);
