import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import * as reportController from '../controllers/reportController';

const router = Router();

router.get('/sales', authenticate, authorize(['reports']), reportController.getSalesReport);
router.get('/payments', authenticate, authorize(['reports']), reportController.getPaymentsReport);
router.get('/defaulters', authenticate, authorize(['reports']), reportController.getDefaultersReport);
router.get('/financial', authenticate, authorize(['reports']), reportController.getFinancialReport);
router.get('/customers', authenticate, authorize(['reports']), reportController.getCustomersReport);

export default router;
