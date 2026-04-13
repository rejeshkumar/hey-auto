import { Request, Response, NextFunction } from 'express';
import { driverService } from './driver.service';

export class DriverController {
  async getProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const profile = await driverService.getProfile(req.user!.userId);
      res.json({ success: true, data: profile });
    } catch (err) {
      next(err);
    }
  }

  async updateProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const profile = await driverService.updateProfile(req.user!.userId, req.body);
      res.json({ success: true, data: profile });
    } catch (err) {
      next(err);
    }
  }

  async addVehicle(req: Request, res: Response, next: NextFunction) {
    try {
      const vehicle = await driverService.addVehicle(req.user!.userId, req.body);
      res.status(201).json({ success: true, data: vehicle });
    } catch (err) {
      next(err);
    }
  }

  async updateVehicle(req: Request, res: Response, next: NextFunction) {
    try {
      const vehicleId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const vehicle = await driverService.updateVehicle(req.user!.userId, vehicleId, req.body);
      res.json({ success: true, data: vehicle });
    } catch (err) {
      next(err);
    }
  }

  async uploadDocument(req: Request, res: Response, next: NextFunction) {
    try {
      const doc = await driverService.uploadDocument(req.user!.userId, req.body);
      res.status(201).json({ success: true, data: doc });
    } catch (err) {
      next(err);
    }
  }

  async getDocuments(req: Request, res: Response, next: NextFunction) {
    try {
      const docs = await driverService.getDocuments(req.user!.userId);
      res.json({ success: true, data: docs });
    } catch (err) {
      next(err);
    }
  }

  async goOnline(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await driverService.goOnline(req.user!.userId);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async goOffline(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await driverService.goOffline(req.user!.userId);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async updateLocation(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await driverService.updateLocation(req.user!.userId, req.body);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async getEarnings(req: Request, res: Response, next: NextFunction) {
    try {
      const period = (req.query.period as string) || 'today';
      const result = await driverService.getEarnings(
        req.user!.userId,
        period as 'today' | 'week' | 'month',
      );
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
}

export const driverController = new DriverController();
