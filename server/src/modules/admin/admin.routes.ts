import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../../middleware/auth';
import { adminService } from './admin.service';

const router = Router();

router.use(authenticate, authorize('ADMIN'));

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

export { router as adminRoutes };
