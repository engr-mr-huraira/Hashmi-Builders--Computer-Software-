import { Response } from 'express';
import pool from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { createRecord, deleteRecord, getRecord, listRecords } from './crudFactory';

const fields = ['entity_type', 'entity_id', 'document_type', 'document_name', 'file_path', 'file_size', 'file_type', 'uploaded_by'];

export const getAllDocuments = listRecords('documents');
export const getDocumentById = getRecord('documents');
export const uploadDocument = createRecord('documents', fields);
export const deleteDocument = deleteRecord('documents');

export const downloadDocument = async (req: AuthRequest, res: Response) => {
  const result = await pool.query('SELECT * FROM documents WHERE id = $1', [req.params.id]);
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Document not found' });
  }
  res.json({ file_path: result.rows[0].file_path, document: result.rows[0] });
};
