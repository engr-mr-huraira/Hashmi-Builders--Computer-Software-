import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import * as documentController from '../controllers/documentController';

const router = Router();

router.get('/', authenticate, documentController.getAllDocuments);
router.get('/:id', authenticate, documentController.getDocumentById);
router.post('/', authenticate, authorize(['documents']), documentController.uploadDocument);
router.delete('/:id', authenticate, authorize(['documents']), documentController.deleteDocument);
router.get('/:id/download', authenticate, documentController.downloadDocument);

export default router;
