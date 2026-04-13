import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/auth';
import { paymentService } from './payment.service';

const router = Router();

router.use(authenticate);

router.post('/create-order', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rideId } = req.body;
    const result = await paymentService.createOrder(req.user!.userId, rideId);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.post('/verify', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await paymentService.verifyPayment(req.user!.userId, req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.get('/wallet/balance', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await paymentService.getWalletBalance(req.user!.userId);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.post('/wallet/topup', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { amount } = req.body;
    const result = await paymentService.topUpWallet(req.user!.userId, amount);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.get('/wallet/transactions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const result = await paymentService.getWalletTransactions(req.user!.userId, page, limit);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

export { router as paymentRoutes };
