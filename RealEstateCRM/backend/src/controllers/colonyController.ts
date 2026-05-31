import { Response } from 'express';
import pool from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { createRecord, deleteRecord, getRecord, listRecords, updateRecord } from './crudFactory';

const fields = [
  'name', 'code', 'location', 'total_plots', 'description', 'map_image',
  'purchase_from', 'purchase_amount', 'advance_paid',
  'total_land', 'road_cut_land', 'bayan_file', 'purchase_papers_file', 'stamp_paper_file', 'payment_plan_client',
  'clearance_duration', 'status', 'created_by',
];

export const getAllColonies = listRecords('colonies');

// Wrap get-by-id so the returned record always reflects the latest auto-status.
export const getColonyById = async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query('SELECT * FROM colonies WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Record not found' });
    }
    await updateColonyAutoStatus(req.params.id);
    const fresh = await pool.query('SELECT * FROM colonies WHERE id = $1', [req.params.id]);
    res.json(fresh.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load colony record' });
  }
};

export const createColony = createRecord('colonies', fields);
export const updateColony = updateRecord('colonies', fields);
export const deleteColony = deleteRecord('colonies');

/**
 * Auto-update colony status to 'completed' when every plot under it is sold.
 * Reverts to 'active' if at least one plot is not sold.
 */
export async function updateColonyAutoStatus(colonyId: string) {
  const sold = await pool.query(
    `SELECT COUNT(*)::int AS sold FROM plots WHERE colony_id = $1 AND status = 'sold'`,
    [colonyId],
  );
  const total = await pool.query(
    `SELECT COUNT(*)::int AS total FROM plots WHERE colony_id = $1`,
    [colonyId],
  );
  const soldCount = sold.rows[0]?.sold || 0;
  const totalCount = total.rows[0]?.total || 0;
  if (totalCount > 0 && soldCount === totalCount) {
    await pool.query(
      `UPDATE colonies SET status = 'completed', updated_at = NOW() WHERE id = $1 AND status <> 'completed'`,
      [colonyId],
    );
  } else {
    await pool.query(
      `UPDATE colonies SET status = 'active', updated_at = NOW() WHERE id = $1 AND status = 'completed'`,
      [colonyId],
    );
  }
}
