import { Router, Request, Response, NextFunction } from 'express';
import express from 'express';
import { authenticate } from '../../middleware/auth';
import { subscriptionService } from './subscription.service';

const router = Router();

// Cashfree webhook — must be raw body for HMAC verification, no auth middleware
router.post(
  '/cashfree-webhook',
  express.raw({ type: 'application/json' }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rawBody = req.body instanceof Buffer ? req.body.toString('utf8') : JSON.stringify(req.body);
      const signature = req.headers['x-webhook-signature'] as string ?? '';
      const timestamp = req.headers['x-webhook-timestamp'] as string ?? '';
      const result = await subscriptionService.handleCashfreeWebhook(rawBody, signature, timestamp);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

// All routes below require auth
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

// Create a Cashfree payment link and return the URL to open in browser
router.post('/create-payment', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { planId } = req.body;
    const result = await subscriptionService.createCashfreeOrder(req.user!.userId, planId);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// Manual UTR fallback (kept for when Cashfree is not configured)
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
