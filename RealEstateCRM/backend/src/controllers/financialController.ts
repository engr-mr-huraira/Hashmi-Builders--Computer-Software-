import { Response } from 'express';
import pool from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { createRecord, getRecord, listRecords } from './crudFactory';

const transactionFields = ['transaction_type', 'colony_id', 'category', 'amount', 'description', 'reference_id', 'reference_type', 'transaction_date', 'created_by'];
const accountFields = ['account_name', 'account_type', 'account_number', 'bank_name', 'branch_name', 'opening_balance', 'current_balance', 'is_active'];

export const getAllTransactions = listRecords('financial_transactions', 'transaction_date');
export const getTransactionById = getRecord('financial_transactions');
export const createTransaction = createRecord('financial_transactions', transactionFields);
export const getAllAccounts = listRecords('accounts');
export const getAccountById = getRecord('accounts');
export const createAccount = createRecord('accounts', accountFields);

export const getFinancialSummary = async (req: AuthRequest, res: Response) => {
  const charity = await pool.query("SELECT COALESCE(SUM(amount), 0) total FROM financial_transactions WHERE transaction_type = 'charity'");
  const expense = await pool.query("SELECT COALESCE(SUM(amount), 0) total FROM financial_transactions WHERE transaction_type = 'expense'");
  const payments = await pool.query('SELECT COALESCE(SUM(amount), 0) total FROM payments');
  res.json({
    charity: Number(charity.rows[0].total),
    expense: Number(expense.rows[0].total),
    payments: Number(payments.rows[0].total),
    profit: Number(payments.rows[0].total) - Number(expense.rows[0].total) - Number(charity.rows[0].total),
  });
};
