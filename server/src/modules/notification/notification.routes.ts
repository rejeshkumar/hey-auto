import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/auth';
import { notificationService } from './notification.service';

const router = Router();

router.use(authenticate);

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const result = await notificationService.getNotifications(req.user!.userId, page, limit);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

router.put('/read', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await notificationService.markAsRead(req.user!.userId, req.body.notificationId);
    res.json({ success: true, data: { message: 'Marked as read' } });
  } catch (err) {
    next(err);
  }
});

router.put('/fcm-token', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await notificationService.updateFcmToken(req.user!.userId, req.body.fcmToken);
    res.json({ success: true, data: { message: 'FCM token updated' } });
  } catch (err) {
    next(err);
  }
});

export { router as notificationRoutes };
