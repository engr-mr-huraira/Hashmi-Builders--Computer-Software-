import { execFile } from 'child_process';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config();

const backupPath = process.argv[2];

if (!backupPath || !fs.existsSync(backupPath)) {
  console.error('Usage: npm run restore -- <backup-file>');
  process.exit(1);
}

const args = [
  '-h', process.env.DB_HOST || 'localhost',
  '-p', process.env.DB_PORT || '5432',
  '-U', process.env.DB_USER || 'postgres',
  '-d', process.env.DB_NAME || 'realestate_crm',
  '--clean',
  '--if-exists',
  backupPath,
];

const child = execFile('pg_restore', args, {
  env: { ...process.env, PGPASSWORD: process.env.DB_PASSWORD || 'postgres' },
}, (error) => {
  if (error) {
    console.error('Restore failed:', error.message);
    process.exit(1);
  }
  console.log('Restore completed successfully.');
});

child.stdout?.pipe(process.stdout);
child.stderr?.pipe(process.stderr);
