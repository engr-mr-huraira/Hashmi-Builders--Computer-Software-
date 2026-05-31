import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'realestate_crm',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function seedData() {
  try {
    console.log('Starting data seeding...');

    const adminPassword = await bcrypt.hash('admin123', 10);

    await pool.query(
      `INSERT INTO users (username, email, password_hash, full_name, role_id)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
      ['admin', 'admin@hashmibuilders.com', adminPassword, 'System Administrator', 1]
    );

    const colonyResult = await pool.query(
      `INSERT INTO colonies (name, code, location, total_plots, description, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      ['Hashmi Garden', 'HG-001', 'Main Boulevard, Lahore', 500, 'Premium residential society', 'active']
    );

    const colonyId = colonyResult.rows[0]?.id;

    if (colonyId) {
      await pool.query(
        `INSERT INTO blocks (colony_id, name, type, description)
         VALUES ($1, $2, $3, $4)`,
        [colonyId, 'Block A', 'block', 'Residential Block A']
      );

      for (let i = 1; i <= 10; i++) {
        await pool.query(
          `INSERT INTO plots (colony_id, plot_number, plot_size, plot_category, plot_type, total_price, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (colony_id, plot_number) DO NOTHING`,
          [colonyId, `A-${i}`, 5.0, '5 Marla', 'residential', 2500000, i <= 3 ? 'sold' : 'available']
        );
      }
    }

    console.log('Data seeding completed successfully.');
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seedData();
