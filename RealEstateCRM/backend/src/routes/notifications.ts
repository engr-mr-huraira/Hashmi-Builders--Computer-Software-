import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import * as notificationController from '../controllers/notificationController';

const router = Router();

router.get('/', authenticate, notificationController.getAllNotifications);
router.get('/:id', authenticate, notificationController.getNotificationById);
router.put('/:id/read', authenticate, notificationController.markAsRead);
router.put('/read-all', authenticate, notificationController.markAllAsRead);
router.delete('/:id', authenticate, notificationController.deleteNotification);

export default router;
