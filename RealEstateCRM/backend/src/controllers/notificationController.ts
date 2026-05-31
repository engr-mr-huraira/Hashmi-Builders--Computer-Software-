import { Response } from 'express';
import pool from '../config/database';
import { AuthRequest } from '../middleware/auth';

export const getAllNotifications = async (req: AuthRequest, res: Response) => {
  const result = await pool.query('SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC', [req.user?.id]);
  res.json(result.rows);
};

export const getNotificationById = async (req: AuthRequest, res: Response) => {
  const result = await pool.query('SELECT * FROM notifications WHERE id = $1 AND user_id = $2', [req.params.id, req.user?.id]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'Notification not found' });
  res.json(result.rows[0]);
};

export const markAsRead = async (req: AuthRequest, res: Response) => {
  const result = await pool.query('UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2 RETURNING *', [req.params.id, req.user?.id]);
  res.json(result.rows[0]);
};

export const markAllAsRead = async (req: AuthRequest, res: Response) => {
  await pool.query('UPDATE notifications SET is_read = true WHERE user_id = $1', [req.user?.id]);
  res.json({ success: true });
};

export const deleteNotification = async (req: AuthRequest, res: Response) => {
  await pool.query('DELETE FROM notifications WHERE id = $1 AND user_id = $2', [req.params.id, req.user?.id]);
  res.json({ success: true });
};
