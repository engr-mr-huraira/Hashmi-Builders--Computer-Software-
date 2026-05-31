import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import * as paymentController from '../controllers/paymentController';

const router = Router();

router.get('/', authenticate, paymentController.getAllPayments);
router.get('/:id', authenticate, paymentController.getPaymentById);
router.post('/', authenticate, authorize(['payments']), paymentController.createPayment);
router.put('/:id', authenticate, authorize(['payments']), paymentController.updatePayment);
router.delete('/:id', authenticate, authorize(['payments']), paymentController.deletePayment);

export default router;
