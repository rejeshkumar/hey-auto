// server/src/modules/payment/subscription.routes.ts
// Add these routes to your existing app.ts or payment routes

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/auth';
import { subscriptionService } from './subscription.service';

const router = Router();

router.use(authenticate);

// GET /api/v1/subscription/status
// Returns: active plan info OR upiLink to open GPay
router.get('/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await subscriptionService.getSubscriptionStatus(req.user!.userId);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/subscription/plans
// Returns all available plans
router.get('/plans', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const plans = await subscriptionService.getPlans();
    res.json({ success: true, data: plans });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/subscription/verify-utr
// Body: { utrNumber: "320417123456" }
// Driver submits UTR after paying via GPay → subscription activated
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
    const result = await subscriptionService.submitUtrAndActivate(
      req.user!.userId,
      utrNumber
    );
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

export { router as subscriptionRoutes };
