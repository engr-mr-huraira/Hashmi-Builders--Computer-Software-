import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import * as colonyController from '../controllers/colonyController';

const router = Router();

router.get('/', authenticate, colonyController.getAllColonies);
router.get('/:id', authenticate, colonyController.getColonyById);
router.post('/', authenticate, authorize(['colonies']), colonyController.createColony);
router.put('/:id', authenticate, authorize(['colonies']), colonyController.updateColony);
router.delete('/:id', authenticate, authorize(['colonies']), colonyController.deleteColony);

export default router;
