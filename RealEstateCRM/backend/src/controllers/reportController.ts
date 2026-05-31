import { Response } from 'express';
import pool from '../config/database';
import { AuthRequest } from '../middleware/auth';

export const getSalesReport = async (req: AuthRequest, res: Response) => {
  const result = await pool.query(`SELECT s.*, c.full_name customer_name, p.plot_number FROM sales s JOIN customers c ON s.customer_id = c.id JOIN plots p ON s.plot_id = p.id ORDER BY s.sale_date DESC`);
  res.json(result.rows);
};

export const getPaymentsReport = async (req: AuthRequest, res: Response) => {
  const result = await pool.query(`SELECT p.*, s.sale_number, c.full_name customer_name FROM payments p JOIN sales s ON p.sale_id = s.id JOIN customers c ON s.customer_id = c.id ORDER BY p.payment_date DESC`);
  res.json(result.rows);
};

export const getDefaultersReport = async (req: AuthRequest, res: Response) => {
  const result = await pool.query(`SELECT i.*, s.sale_number, c.full_name customer_name, c.phone FROM installments i JOIN sales s ON i.sale_id = s.id JOIN customers c ON s.customer_id = c.id WHERE i.status = 'pending' AND i.due_date < NOW() ORDER BY i.due_date ASC`);
  res.json(result.rows);
};

export const getFinancialReport = async (req: AuthRequest, res: Response) => {
  const result = await pool.query(`SELECT transaction_type, category, SUM(amount) total FROM financial_transactions GROUP BY transaction_type, category ORDER BY transaction_type, category`);
  res.json(result.rows);
};

export const getCustomersReport = async (req: AuthRequest, res: Response) => {
  const result = await pool.query(`SELECT c.*, COUNT(s.id) total_sales, COALESCE(SUM(s.total_price), 0) total_value FROM customers c LEFT JOIN sales s ON c.id = s.customer_id GROUP BY c.id ORDER BY c.created_at DESC`);
  res.json(result.rows);
};
