import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import * as financialController from '../controllers/financialController';

const router = Router();

router.get('/transactions', authenticate, financialController.getAllTransactions);
router.get('/transactions/:id', authenticate, financialController.getTransactionById);
router.post('/transactions', authenticate, authorize(['financial']), financialController.createTransaction);
router.get('/accounts', authenticate, financialController.getAllAccounts);
router.get('/accounts/:id', authenticate, financialController.getAccountById);
router.post('/accounts', authenticate, authorize(['financial']), financialController.createAccount);
router.get('/summary', authenticate, financialController.getFinancialSummary);

export default router;
