import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/auth';
import { subscriptionService } from './subscription.service';

const router = Router();

router.use(authenticate);

router.get('/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await subscriptionService.getSubscriptionStatus(req.user!.userId);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.get('/plans', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const plans = await subscriptionService.getPlans();
    res.json({ success: true, data: plans });
  } catch (err) {
    next(err);
  }
});

router.post('/verify-utr', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { utrNumber } = req.body;
    if (!utrNumber) {
      return res.status(400).json({
        success: false,
        message: 'UTR number is required',
        messageMl: 'UTR നമ്പർ നൽകൂ',
      });
    }
    const result = await subscriptionService.submitUtrAndActivate(req.user!.userId, utrNumber);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

export { router as subscriptionRoutes };
