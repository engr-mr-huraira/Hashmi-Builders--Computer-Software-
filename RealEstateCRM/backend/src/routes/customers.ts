import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import * as customerController from '../controllers/customerController';

const router = Router();

router.get('/', authenticate, customerController.getAllCustomers);
router.get('/:id', authenticate, customerController.getCustomerById);
router.post('/', authenticate, authorize(['customers']), customerController.createCustomer);
router.put('/:id', authenticate, authorize(['customers']), customerController.updateCustomer);
router.delete('/:id', authenticate, authorize(['customers']), customerController.deleteCustomer);

export default router;
