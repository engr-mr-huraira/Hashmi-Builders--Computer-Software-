import { Response } from 'express';
import pool from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { createRecord, getRecord, listRecords, updateRecord } from './crudFactory';

const fields = ['sale_id', 'customer_id', 'refund_number', 'request_date', 'refund_amount', 'deduction_amount', 'deduction_reason', 'approval_status', 'approved_by', 'approved_date', 'refund_date', 'payment_method', 'bank_name', 'cheque_number', 'transaction_id', 'bank_details', 'notes'];

export const getAllRefunds = listRecords('refunds');
export const getRefundById = getRecord('refunds');

const baseCreateRefund = createRecord('refunds', fields);
export const createRefund = async (req: AuthRequest, res: Response) => {
  if (req.body.sale_id && !req.body.customer_id) {
    try {
      const sale = await pool.query('SELECT customer_id FROM sales WHERE id = $1', [req.body.sale_id]);
      if (sale.rows[0]) {
        req.body.customer_id = sale.rows[0].customer_id;
      }
    } catch (e) {}
  }
  await baseCreateRefund(req, res);
  if (!res.writableEnded && req.body.sale_id) {
    try {
      const { updateColonyAutoStatus } = await import('./colonyController');
      // Update sale status to cancelled
      await pool.query("UPDATE sales SET status = 'cancelled', updated_at = NOW() WHERE id = $1", [req.body.sale_id]);
      // Get plot_id and shop_id from sale
      const sale = await pool.query("SELECT plot_id, shop_id FROM sales WHERE id = $1", [req.body.sale_id]);
      if (sale.rows[0]?.plot_id) {
        // Update plot status to cancelled and remove owner
        await pool.query("UPDATE plots SET status = 'cancelled', current_owner_id = NULL, updated_at = NOW() WHERE id = $1", [sale.rows[0].plot_id]);
        // Re-evaluate colony status
        const plot = await pool.query('SELECT colony_id FROM plots WHERE id = $1', [sale.rows[0].plot_id]);
        if (plot.rows[0]?.colony_id) {
          await updateColonyAutoStatus(plot.rows[0].colony_id);
        }
      }
      if (sale.rows[0]?.shop_id) {
        // Restore shop to available
        await pool.query("UPDATE shops SET status = 'available', updated_at = NOW() WHERE id = $1", [sale.rows[0].shop_id]);
        const shop = await pool.query('SELECT colony_id FROM shops WHERE id = $1', [sale.rows[0].shop_id]);
        if (shop.rows[0]?.colony_id) {
          await updateColonyAutoStatus(shop.rows[0].colony_id);
        }
      }
    } catch (e) {}
  }
};

export const updateRefund = updateRecord('refunds', fields);

export const approveRefund = async (req: AuthRequest, res: Response) => {
  const result = await pool.query('UPDATE refunds SET approval_status = $1, approved_by = $2, approved_date = NOW(), updated_at = NOW() WHERE id = $3 RETURNING *', ['approved', req.user?.id, req.params.id]);
  res.json(result.rows[0]);
};

export const rejectRefund = async (req: AuthRequest, res: Response) => {
  const result = await pool.query('UPDATE refunds SET approval_status = $1, approved_by = $2, approved_date = NOW(), updated_at = NOW() WHERE id = $3 RETURNING *', ['rejected', req.user?.id, req.params.id]);
  res.json(result.rows[0]);
};
