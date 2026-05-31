import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import * as shopController from '../controllers/shopController';

const router = Router();

router.get('/', authenticate, shopController.getAllShops);
router.get('/:id', authenticate, shopController.getShopById);
router.post('/', authenticate, authorize(['plots']), shopController.createShop);
router.put('/:id', authenticate, authorize(['plots']), shopController.updateShop);
router.delete('/:id', authenticate, authorize(['plots']), shopController.deleteShop);

export default router;
