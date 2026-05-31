import { Response } from 'express';
import pool from '../config/database';
import { AuthRequest } from '../middleware/auth';

export const listRecords = (table: string, orderBy = 'created_at') => async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(parseInt(String(req.query.page || '1')), 1);
    const limit = Math.min(Math.max(parseInt(String(req.query.limit || '25')), 1), 100);
    const offset = (page - 1) * limit;
    const search = String(req.query.search || '').trim();

    let query = `SELECT * FROM ${table}`;
    const values: any[] = [];

    if (search) {
      query += ` WHERE CAST(row_to_json(${table}) AS TEXT) ILIKE $1`;
      values.push(`%${search}%`);
    }

    query += ` ORDER BY ${orderBy} DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
    values.push(limit, offset);

    const result = await pool.query(query, values);
    const countResult = await pool.query(`SELECT COUNT(*) FROM ${table}`);

    res.json({ data: result.rows, page, limit, total: Number(countResult.rows[0].count) });
  } catch (error) {
    res.status(500).json({ error: `Failed to load ${table}` });
  }
};

export const getRecord = (table: string) => async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(`SELECT * FROM ${table} WHERE id = $1`, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Record not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: `Failed to load ${table} record` });
  }
};

export const createRecord = (table: string, allowedFields: string[]) => async (req: AuthRequest, res: Response) => {
  try {
    const fields = allowedFields.filter((field) => req.body[field] !== undefined);
    const values = fields.map((field) => req.body[field]);
    const placeholders = fields.map((_, index) => `$${index + 1}`).join(', ');

    const result = await pool.query(
      `INSERT INTO ${table} (${fields.join(', ')}) VALUES (${placeholders}) RETURNING *`,
      values
    );

    await pool.query(
      'INSERT INTO sync_queue (table_name, record_id, operation, data) VALUES ($1, $2, $3, $4)',
      [table, result.rows[0].id, 'create', result.rows[0]]
    );

    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message || `Failed to create ${table} record` });
  }
};

export const updateRecord = (table: string, allowedFields: string[]) => async (req: AuthRequest, res: Response) => {
  try {
    const fields = allowedFields.filter((field) => req.body[field] !== undefined);
    const values = fields.map((field) => req.body[field]);
    const assignments = fields.map((field, index) => `${field} = $${index + 1}`).join(', ');

    const result = await pool.query(
      `UPDATE ${table} SET ${assignments}, updated_at = NOW() WHERE id = $${fields.length + 1} RETURNING *`,
      [...values, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Record not found' });
    }

    await pool.query(
      'INSERT INTO sync_queue (table_name, record_id, operation, data) VALUES ($1, $2, $3, $4)',
      [table, req.params.id, 'update', result.rows[0]]
    );

    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message || `Failed to update ${table} record` });
  }
};

export const deleteRecord = (table: string) => async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(`DELETE FROM ${table} WHERE id = $1 RETURNING *`, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Record not found' });
    }

    await pool.query(
      'INSERT INTO sync_queue (table_name, record_id, operation, data) VALUES ($1, $2, $3, $4)',
      [table, req.params.id, 'delete', result.rows[0]]
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: `Failed to delete ${table} record` });
  }
};
