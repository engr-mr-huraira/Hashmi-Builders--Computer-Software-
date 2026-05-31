import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import * as saleController from '../controllers/saleController';

const router = Router();

router.get('/', authenticate, saleController.getAllSales);
router.get('/:id', authenticate, saleController.getSaleById);
router.post('/', authenticate, authorize(['sales']), saleController.createSale);
router.put('/:id', authenticate, authorize(['sales']), saleController.updateSale);
router.delete('/:id', authenticate, authorize(['sales']), saleController.deleteSale);
router.post('/:id/transfer', authenticate, authorize(['sales']), saleController.transferSale);
router.post('/:id/cancel', authenticate, authorize(['sales']), saleController.cancelSale);

export default router;
