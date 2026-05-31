import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import * as plotController from '../controllers/plotController';

const router = Router();

router.get('/', authenticate, plotController.getAllPlots);
router.get('/:id', authenticate, plotController.getPlotById);
router.post('/', authenticate, authorize(['plots']), plotController.createPlot);
router.put('/:id', authenticate, authorize(['plots']), plotController.updatePlot);
router.delete('/:id', authenticate, authorize(['plots']), plotController.deletePlot);

export default router;
