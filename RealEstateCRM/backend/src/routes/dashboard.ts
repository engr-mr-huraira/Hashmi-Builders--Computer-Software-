import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import * as dashboardController from '../controllers/dashboardController';

const router = Router();

router.get('/stats', authenticate, dashboardController.getDashboardStats);
router.get('/recent-activities', authenticate, dashboardController.getRecentActivities);
router.get('/revenue-chart', authenticate, dashboardController.getRevenueChart);
router.get('/plot-status', authenticate, dashboardController.getPlotStatus);
router.get('/colony-stats', authenticate, dashboardController.getColonyStats);
router.get('/upcoming-installments', authenticate, dashboardController.getUpcomingInstallments);

export default router;
