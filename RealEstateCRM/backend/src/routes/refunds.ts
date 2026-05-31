import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import * as refundController from '../controllers/refundController';

const router = Router();

router.get('/', authenticate, refundController.getAllRefunds);
router.get('/:id', authenticate, refundController.getRefundById);
router.post('/', authenticate, authorize(['refunds']), refundController.createRefund);
router.put('/:id', authenticate, authorize(['refunds']), refundController.updateRefund);
router.post('/:id/approve', authenticate, authorize(['refunds']), refundController.approveRefund);
router.post('/:id/reject', authenticate, authorize(['refunds']), refundController.rejectRefund);

export default router;
