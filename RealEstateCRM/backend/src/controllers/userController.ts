import { Response } from 'express';
import bcrypt from 'bcryptjs';
import pool from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { deleteRecord, getRecord, listRecords, updateRecord } from './crudFactory';

const fields = ['username', 'email', 'full_name', 'phone', 'role_id', 'is_active'];

export const getAllUsers = listRecords('users');
export const getUserById = getRecord('users');
export const updateUser = updateRecord('users', fields);
export const deleteUser = deleteRecord('users');

export const createUser = async (req: AuthRequest, res: Response) => {
  const { username, email, password, full_name, phone, role_id, is_active } = req.body;
  const passwordHash = await bcrypt.hash(password, 10);
  const result = await pool.query('INSERT INTO users (username, email, password_hash, full_name, phone, role_id, is_active) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, username, email, full_name, phone, role_id, is_active, created_at', [username, email, passwordHash, full_name, phone, role_id, is_active ?? true]);
  res.status(201).json(result.rows[0]);
};

export const getAllRoles = async (req: AuthRequest, res: Response) => {
  const result = await pool.query('SELECT * FROM roles ORDER BY id ASC');
  res.json(result.rows);
};
