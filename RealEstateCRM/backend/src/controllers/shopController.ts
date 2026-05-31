import { Response } from 'express';
import pool from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { createRecord, deleteRecord, getRecord, listRecords, updateRecord } from './crudFactory';

const fields = ['colony_id', 'plot_id', 'shop_number', 'size', 'dimensions', 'price', 'status', 'created_by'];

export const getAllShops = async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(parseInt(String(req.query.page || '1')), 1);
    const limit = Math.min(Math.max(parseInt(String(req.query.limit || '200')), 1), 500);
    const offset = (page - 1) * limit;
    const search = String(req.query.search || '').trim();
    const colonyId = String(req.query.colony_id || '').trim();
    const plotId = String(req.query.plot_id || '').trim();
    const status = String(req.query.status || '').trim();

    let query = `SELECT s.*, c.name AS colony_name, p.plot_number FROM shops s LEFT JOIN colonies c ON c.id = s.colony_id LEFT JOIN plots p ON p.id = s.plot_id`;
    const conditions: string[] = [];
    const values: any[] = [];

    if (search) {
      conditions.push(`(s.shop_number ILIKE $${values.length + 1} OR p.plot_number ILIKE $${values.length + 1})`);
      values.push(`%${search}%`);
    }
    if (colonyId) {
      conditions.push(`s.colony_id = $${values.length + 1}`);
      values.push(colonyId);
    }
    if (plotId) {
      conditions.push(`s.plot_id = $${values.length + 1}`);
      values.push(plotId);
    }
    if (status) {
      conditions.push(`s.status = $${values.length + 1}`);
      values.push(status);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ` ORDER BY s.created_at DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
    values.push(limit, offset);

    const result = await pool.query(query, values);
    const countQuery = `SELECT COUNT(*) FROM shops s LEFT JOIN plots p ON p.id = s.plot_id${conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : ''}`;
    const countResult = await pool.query(countQuery, values.slice(0, values.length - 2));

    res.json({ data: result.rows, page, limit, total: Number(countResult.rows[0].count) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load shops' });
  }
};

export const getShopById = async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT s.*, c.name AS colony_name, p.plot_number FROM shops s LEFT JOIN colonies c ON c.id = s.colony_id LEFT JOIN plots p ON p.id = s.plot_id WHERE s.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Shop not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load shop details' });
  }
};

const baseCreate = createRecord('shops', fields);
export const createShop = async (req: AuthRequest, res: Response) => {
  if (!req.body?.shop_number && req.body?.colony_id) {
    try {
      const latest = await pool.query(
        "SELECT shop_number FROM shops WHERE colony_id = $1 ORDER BY created_at DESC, id DESC LIMIT 1",
        [req.body.colony_id]
      );
      let nextNum = 1;
      let prefix = 'Shop # ';
      let suffixLen = 2;
      if (latest.rows.length > 0) {
        const lastNo = latest.rows[0].shop_number;
        const match = lastNo.match(/^(.*?)(\d+)$/);
        if (match) {
          prefix = match[1];
          nextNum = parseInt(match[2], 10) + 1;
          suffixLen = match[2].length;
        }
      }
      const paddedNum = String(nextNum).padStart(suffixLen, '0');
      req.body.shop_number = `${prefix}${paddedNum}`;
    } catch (e) {
      req.body.shop_number = 'Shop # 01';
    }
  }
  await baseCreate(req, res);
};

export const updateShop = updateRecord('shops', fields);
export const deleteShop = deleteRecord('shops');
