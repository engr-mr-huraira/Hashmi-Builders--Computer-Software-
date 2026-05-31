import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import * as userController from '../controllers/userController';

const router = Router();

router.get('/', authenticate, authorize(['users']), userController.getAllUsers);
router.get('/:id', authenticate, userController.getUserById);
router.post('/', authenticate, authorize(['users']), userController.createUser);
router.put('/:id', authenticate, authorize(['users']), userController.updateUser);
router.delete('/:id', authenticate, authorize(['users']), userController.deleteUser);
router.get('/roles/all', authenticate, userController.getAllRoles);

export default router;
