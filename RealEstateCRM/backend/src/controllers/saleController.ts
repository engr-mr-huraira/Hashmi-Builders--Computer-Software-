import { Response } from 'express';
import pool from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { createRecord, deleteRecord, getRecord, listRecords, updateRecord } from './crudFactory';
import { updateColonyAutoStatus } from './colonyController';

const fields = ['plot_id', 'shop_id', 'colony_id', 'customer_id', 'sale_number', 'sale_date', 'booking_amount', 'total_price', 'discount_amount', 'payment_plan', 'installment_months', 'monthly_installment', 'down_payment', 'status', 'agreement_number', 'transfer_count', 'created_by'];

export const getAllSales = async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(parseInt(String(req.query.page || '1')), 1);
    const limit = Math.min(Math.max(parseInt(String(req.query.limit || '200')), 1), 500);
    const offset = (page - 1) * limit;
    const search = String(req.query.search || '').trim();

    let query = `
      SELECT s.*, c.full_name AS customer_name, p.plot_number, sh.shop_number
      FROM sales s
      JOIN customers c ON c.id = s.customer_id
      LEFT JOIN plots p ON p.id = s.plot_id
      LEFT JOIN shops sh ON sh.id = s.shop_id
    `;
    const values: any[] = [];

    if (search) {
      query += ` WHERE c.full_name ILIKE $1 OR s.sale_number ILIKE $1 OR p.plot_number ILIKE $1 OR sh.shop_number ILIKE $1`;
      values.push(`%${search}%`);
    }

    query += ` ORDER BY s.created_at DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
    values.push(limit, offset);

    const result = await pool.query(query, values);
    const countResult = await pool.query(`SELECT COUNT(*) FROM sales`);

    res.json({ data: result.rows, page, limit, total: Number(countResult.rows[0].count) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load sales' });
  }
};

export const getSaleById = async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT s.*,
              c.full_name AS customer_name,
              p.plot_number, p.plot_size,
              sh.shop_number, sh.size AS shop_size, sh.dimensions AS shop_dimensions,
              COALESCE(col.name, col2.name) AS colony_name,
              COALESCE((SELECT SUM(amount)::numeric FROM payments WHERE sale_id = s.id), 0) AS total_paid
       FROM sales s
       JOIN customers c ON c.id = s.customer_id
       LEFT JOIN plots p ON p.id = s.plot_id
       LEFT JOIN shops sh ON sh.id = s.shop_id
       LEFT JOIN colonies col ON col.id = p.colony_id
       LEFT JOIN colonies col2 ON col2.id = sh.colony_id
       WHERE s.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Sale not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load sale details' });
  }
};

const baseCreate = createRecord('sales', fields);
export const createSale = async (req: AuthRequest, res: Response) => {
  if (!req.body?.sale_number) {
    try {
      const latest = await pool.query(
        "SELECT sale_number FROM sales ORDER BY created_at DESC, id DESC LIMIT 1"
      );
      let nextNum = 1;
      let prefix = '';
      let suffixLen = 2;
      if (latest.rows.length > 0) {
        const lastNo = latest.rows[0].sale_number;
        const match = lastNo.match(/^(.*?)(\d+)$/);
        if (match) {
          prefix = match[1];
          nextNum = parseInt(match[2], 10) + 1;
          suffixLen = match[2].length;
        }
      }
      const paddedNum = String(nextNum).padStart(suffixLen, '0');
      req.body.sale_number = `${prefix}${paddedNum}`;
    } catch (e) {
      req.body.sale_number = '01';
    }
  }
  await baseCreate(req, res);
  if (!res.writableEnded && req.body?.plot_id) {
    try {
      await pool.query(
        "UPDATE plots SET status = 'sold', current_owner_id = $1, updated_at = NOW() WHERE id = $2",
        [req.body.customer_id, req.body.plot_id]
      );
      const plot = await pool.query('SELECT colony_id FROM plots WHERE id = $1', [req.body.plot_id]);
      if (plot.rows[0]?.colony_id) {
        await updateColonyAutoStatus(plot.rows[0].colony_id);
      }
    } catch (e) {}
  }
  if (!res.writableEnded && req.body?.shop_id) {
    try {
      await pool.query(
        "UPDATE shops SET status = 'sold', updated_at = NOW() WHERE id = $1",
        [req.body.shop_id]
      );
      const shop = await pool.query('SELECT colony_id FROM shops WHERE id = $1', [req.body.shop_id]);
      if (shop.rows[0]?.colony_id) {
        await updateColonyAutoStatus(shop.rows[0].colony_id);
      }
    } catch (e) {}
  }
};

export const updateSale = updateRecord('sales', fields);
export const deleteSale = deleteRecord('sales');

export const transferSale = async (req: AuthRequest, res: Response) => {
  const { customer_id } = req.body;
  const result = await pool.query('UPDATE sales SET customer_id = $1, transfer_count = transfer_count + 1, updated_at = NOW() WHERE id = $2 RETURNING *', [customer_id, req.params.id]);
  res.json(result.rows[0]);
};

export const cancelSale = async (req: AuthRequest, res: Response) => {
  const result = await pool.query('UPDATE sales SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *', ['cancelled', req.params.id]);
  if (result.rows[0]?.plot_id) {
    await pool.query('UPDATE plots SET status = $1, current_owner_id = NULL, updated_at = NOW() WHERE id = $2', ['available', result.rows[0].plot_id]);
  }
  if (result.rows[0]?.shop_id) {
    await pool.query('UPDATE shops SET status = $1, updated_at = NOW() WHERE id = $2', ['available', result.rows[0].shop_id]);
  }
  // Re-evaluate colony status: a cancelled sale may mean the colony is no longer fully sold.
  const reEvalId = result.rows[0]?.plot_id || result.rows[0]?.shop_id;
  if (reEvalId) {
    const entity = result.rows[0]?.plot_id ? 'plots' : 'shops';
    const col = await pool.query(`SELECT colony_id FROM ${entity} WHERE id = $1`, [reEvalId]);
    if (col.rows[0]?.colony_id) {
      try { await updateColonyAutoStatus(col.rows[0].colony_id) } catch (_) {}
    }
  }
  res.json(result.rows[0]);
};
