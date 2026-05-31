import { Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import pool from '../config/database';
import { AuthRequest } from '../middleware/auth';

const signToken = (user: any) => {
  const options: SignOptions = { expiresIn: (process.env.JWT_EXPIRE || '7d') as SignOptions['expiresIn'] };

  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role_name,
      permissions: user.permissions || [],
    },
    process.env.JWT_SECRET || 'your-secret-key',
    options
  );
};

export const login = async (req: AuthRequest, res: Response) => {
  try {
    const { username, password } = req.body;

    const result = await pool.query(
      `SELECT u.*, r.name as role_name, r.permissions
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE (u.username = $1 OR u.email = $1) AND u.is_active = true`,
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

    const token = signToken(user);
    delete user.password_hash;

    res.json({ token, user });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
};

export const register = async (req: AuthRequest, res: Response) => {
  try {
    const { username, email, password, full_name, phone, role_id } = req.body;
    const passwordHash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (username, email, password_hash, full_name, phone, role_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, username, email, full_name, phone, role_id, is_active, created_at`,
      [username, email, passwordHash, full_name, phone, role_id || 5]
    );

    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Username or email already exists' });
    }
    res.status(500).json({ error: 'Registration failed' });
  }
};

export const getProfile = async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.username, u.email, u.full_name, u.phone, u.is_active, u.last_login,
              r.name as role_name, r.permissions
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.id = $1`,
      [req.user?.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load profile' });
  }
};

export const updateProfile = async (req: AuthRequest, res: Response) => {
  try {
    const { full_name, phone, email } = req.body;
    const result = await pool.query(
      `UPDATE users SET full_name = $1, phone = $2, email = $3, updated_at = NOW()
       WHERE id = $4
       RETURNING id, username, email, full_name, phone, updated_at`,
      [full_name, phone, email, req.user?.id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
};

export const getPublicRoles = async (req: any, res: Response) => {
  try {
    const result = await pool.query('SELECT id, name FROM roles ORDER BY name ASC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load roles' });
  }
};
