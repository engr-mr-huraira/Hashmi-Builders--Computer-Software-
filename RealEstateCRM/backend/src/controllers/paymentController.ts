import { Response } from 'express';
import pool from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { createRecord, deleteRecord, getRecord, listRecords, updateRecord } from './crudFactory';

const fields = ['sale_id', 'installment_id', 'payment_number', 'payment_date', 'amount', 'payment_method', 'bank_name', 'cheque_number', 'transaction_id', 'receipt_number', 'notes', 'received_by'];

export const getAllPayments = listRecords('payments');
export const getPaymentById = getRecord('payments');

const baseCreate = createRecord('payments', fields);
export const createPayment = async (req: AuthRequest, res: Response) => {
  if (!req.body?.payment_number) {
    try {
      const latest = await pool.query(
        "SELECT payment_number FROM payments ORDER BY created_at DESC, id DESC LIMIT 1"
      );
      let nextNum = 1;
      let prefix = '';
      let suffixLen = 2;
      if (latest.rows.length > 0) {
        const lastNo = latest.rows[0].payment_number;
        const match = lastNo.match(/^(.*?)(\d+)$/);
        if (match) {
          prefix = match[1];
          nextNum = parseInt(match[2], 10) + 1;
          suffixLen = match[2].length;
        }
      }
      const paddedNum = String(nextNum).padStart(suffixLen, '0');
      req.body.payment_number = `${prefix}${paddedNum}`;
    } catch (e) {
      req.body.payment_number = '01';
    }
  }
  await baseCreate(req, res);
  if (!res.writableEnded && req.body?.sale_id) {
    try {
      const saleQuery = await pool.query("SELECT total_price FROM sales WHERE id = $1", [req.body.sale_id]);
      const totalPaidQuery = await pool.query("SELECT COALESCE(SUM(amount), 0) AS total_paid FROM payments WHERE sale_id = $1", [req.body.sale_id]);
      if (saleQuery.rows[0]) {
        const totalPrice = parseFloat(saleQuery.rows[0].total_price);
        const totalPaid = parseFloat(totalPaidQuery.rows[0].total_paid);
        if (totalPaid >= totalPrice) {
          await pool.query("UPDATE sales SET status = 'completed', updated_at = NOW() WHERE id = $1", [req.body.sale_id]);
        }
      }
    } catch (e) {}
  }
};

export const updatePayment = updateRecord('payments', fields);
export const deletePayment = deleteRecord('payments');
