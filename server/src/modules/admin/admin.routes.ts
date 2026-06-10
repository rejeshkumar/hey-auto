import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { adminService } from './admin.service';
import { authService } from '../auth/auth.service';
import { adminSendOtpSchema, adminVerifyOtpSchema } from '../auth/auth.schema';
import { redis } from '../../config/redis';

const router = Router();

// ── Admin auth endpoints (no auth middleware — these ARE the login) ──────────
router.post('/auth/send-otp', validate(adminSendOtpSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await authService.sendOtp({ ...req.body, role: 'ADMIN' });
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

router.post('/auth/verify-otp', validate(adminVerifyOtpSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await authService.verifyOtp({ ...req.body, role: 'ADMIN' });
    // Verify the resolved user is actually ADMIN role
    if (result.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Not an admin account' } });
    }
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

// ── All routes below require ADMIN JWT ───────────────────────────────────────
router.use(authenticate, authorize('ADMIN'));

// Clear stuck active-ride Redis key for a rider (useful when DB has no active ride but Redis does)
router.post('/fix-rider/:userId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;
    const key = `active_ride:${userId}`;
    const val = await redis.get(key);
    await redis.del(key);
    res.json({ success: true, data: { cleared: key, hadValue: val } });
  } catch (err) { next(err); }
});

router.get('/dashboard', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await adminService.getDashboardStats();
    res.json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
});

router.get('/drivers', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await adminService.getDrivers({
      status: req.query.status as string,
      city: req.query.city as string,
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
      search: req.query.search as string,
    });
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

router.get('/drivers/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await adminService.getDriver(req.params.id as string);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.put('/drivers/:id/verify', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { action } = req.body;
    const driverId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const result = await adminService.verifyDriver(driverId, action, req.user!.userId);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.get('/documents/pending', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const result = await adminService.getPendingDocuments(page, limit);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

router.put('/documents/:id/verify', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { action, rejectionReason } = req.body;
    const docId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const result = await adminService.verifyDocument(docId, action, req.user!.userId, rejectionReason);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.get('/rides', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await adminService.getRides({
      status: req.query.status as string,
      city: req.query.city as string,
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
      dateFrom: req.query.dateFrom as string,
      dateTo: req.query.dateTo as string,
    });
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

router.post('/rides/:id/cancel', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { prisma } = await import('../../config/database');
    const { redis } = await import('../../config/redis');
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const ride = await prisma.ride.findUnique({ where: { id } });
    if (!ride) { res.status(404).json({ success: false, error: { message: 'Ride not found' } }); return; }
    await prisma.ride.update({ where: { id }, data: { status: 'CANCELLED_RIDER', cancelledAt: new Date(), cancellationReason: 'Admin force-cancel' } });
    await redis.del(`active_ride:${ride.riderId}`);
    if (ride.driverId) {
      await prisma.driverProfile.update({ where: { userId: ride.driverId }, data: { isOnRide: false } });
    }
    await redis.publish('ride_events', JSON.stringify({ type: 'ride:cancelled', rideId: id, riderId: ride.riderId, driverId: ride.driverId, cancelledBy: 'ADMIN' }));
    res.json({ success: true, data: { cancelled: true } });
  } catch (err) { next(err); }
});

router.get('/riders', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await adminService.getRiders({
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
      search: req.query.search as string,
    });
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

router.post('/drivers', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await adminService.createDriver(req.body);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.get('/subscription-plans', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const plans = await adminService.getSubscriptionPlans();
    res.json({ success: true, data: plans });
  } catch (err) {
    next(err);
  }
});

router.put('/subscription-plans/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const plan = await adminService.updateSubscriptionPlan(req.params.id as string, req.body);
    res.json({ success: true, data: plan });
  } catch (err) {
    next(err);
  }
});

router.get('/subscriptions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const pending = req.query.pending === 'true';
    const result = pending
      ? await adminService.getPendingSubscriptions(page, limit)
      : await adminService.getAllSubscriptions(page, limit);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

router.put('/subscriptions/:id/verify', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { action } = req.body;
    const result = await adminService.verifySubscription(req.params.id as string, action);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.put('/users/fix-role', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phone, role, status } = req.body;
    const { prisma } = await import('../../config/database');
    const updated = await prisma.user.updateMany({
      where: { phone: phone.startsWith('+91') ? phone : `+91${phone}` },
      data: { role, status },
    });
    res.json({ success: true, data: { updated: updated.count, phone, role, status } });
  } catch (err) {
    next(err);
  }
});

router.get('/fare-config', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const city = (req.query.city as string) || 'Taliparamba';
    const vehicleType = (req.query.vehicleType as 'AUTO' | 'E_AUTO') || 'AUTO';
    const result = await adminService.getFareConfig(city, vehicleType);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.post('/fare-config', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await adminService.updateFareConfig(req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// ── Auto Stands ─────────────────────────────────────────────────────────────

router.get('/stands', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const { prisma } = await import('../../config/database');
    const stands = await prisma.autoStand.findMany({
      include: { _count: { select: { queueEntries: true } } },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ success: true, data: stands });
  } catch (err) { next(err); }
});

router.post('/stands', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { prisma } = await import('../../config/database');
    const { name, city, lat, lng, radiusMeters, maxCapacity } = req.body;
    const stand = await prisma.autoStand.create({
      data: { name, city: city.toLowerCase(), lat, lng, radiusMeters: radiusMeters ?? 100, maxCapacity: maxCapacity ?? 20 },
    });
    res.status(201).json({ success: true, data: stand });
  } catch (err) { next(err); }
});

router.patch('/stands/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { prisma } = await import('../../config/database');
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const stand = await prisma.autoStand.update({
      where: { id },
      data: req.body,
    });
    res.json({ success: true, data: stand });
  } catch (err) { next(err); }
});

router.delete('/stands/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { prisma } = await import('../../config/database');
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    await prisma.autoStand.delete({ where: { id } });
    res.json({ success: true, data: { deleted: true } });
  } catch (err) { next(err); }
});

export { router as adminRoutes };
