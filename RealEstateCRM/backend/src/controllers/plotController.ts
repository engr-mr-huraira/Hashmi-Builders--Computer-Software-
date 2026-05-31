import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { createRecord, deleteRecord, getRecord, listRecords, updateRecord } from './crudFactory';
import { updateColonyAutoStatus } from './colonyController';

const fields = ['colony_id', 'block_id', 'plot_number', 'plot_size', 'plot_category', 'plot_type', 'dimensions', 'is_corner', 'is_facing_park', 'is_commercial', 'price_per_marla', 'total_price', 'status', 'booking_date', 'current_owner_id', 'created_by'];

export const getAllPlots = listRecords('plots');
export const getPlotById = getRecord('plots');
export const deletePlot = deleteRecord('plots');

// Wrap create/update so colony auto-status is re-evaluated whenever a plot changes.
const baseCreate = createRecord('plots', fields);
export const createPlot = async (req: AuthRequest, res: Response) => {
  if (!req.body?.plot_number && req.body?.colony_id) {
    try {
      const pool = (await import('../config/database')).default;
      const latest = await pool.query(
        "SELECT plot_number FROM plots WHERE colony_id = $1 ORDER BY created_at DESC, id DESC LIMIT 1",
        [req.body.colony_id]
      );
      let nextNum = 1;
      let prefix = 'Plot # ';
      let suffixLen = 2;
      if (latest.rows.length > 0) {
        const lastNo = latest.rows[0].plot_number;
        const match = lastNo.match(/^(.*?)(\d+)$/);
        if (match) {
          prefix = match[1];
          nextNum = parseInt(match[2], 10) + 1;
          suffixLen = match[2].length;
        }
      }
      const paddedNum = String(nextNum).padStart(suffixLen, '0');
      req.body.plot_number = `${prefix}${paddedNum}`;
    } catch (e) {
      req.body.plot_number = 'Plot # 01';
    }
  }
  await baseCreate(req, res);
  if (!res.writableEnded && req.body?.colony_id) {
    try { await updateColonyAutoStatus(req.body.colony_id) } catch (_) {}
  }
};

const baseUpdate = updateRecord('plots', fields);
export const updatePlot = async (req: AuthRequest, res: Response) => {
  // Fetch existing colony_id in case the body doesn't contain it on a partial update.
  const pool = (await import('../config/database')).default;
  let colonyId = req.body?.colony_id;
  if (!colonyId) {
    try {
      const prev = await pool.query('SELECT colony_id FROM plots WHERE id = $1', [req.params.id]);
      if (prev.rows[0]) colonyId = prev.rows[0].colony_id;
    } catch (_) {}
  }
  await baseUpdate(req, res);
  if (!res.writableEnded && colonyId) {
    try { await updateColonyAutoStatus(colonyId) } catch (_) {}
  }
};
