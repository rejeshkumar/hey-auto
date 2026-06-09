import { Request, Response, NextFunction } from 'express';
import { driverService } from './driver.service';
import { uploadFileToStorage } from '../../services/upload';

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
      let docUrl: string | undefined = req.body.docUrl;

      if (req.file) {
        docUrl = await uploadFileToStorage(
          req.file.buffer,
          req.file.originalname,
          req.file.mimetype,
          'documents',
        );
      }

      if (!docUrl) {
        res.status(400).json({ success: false, error: { code: 'MISSING_FILE', message: 'No file uploaded' } });
        return;
      }

      const doc = await driverService.uploadDocument(req.user!.userId, { ...req.body, docUrl });
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
      const { lat, lng } = req.body;
      if (lat && lng) {
        await driverService.updateLocation(req.user!.userId, { lat: parseFloat(lat), lng: parseFloat(lng) });
      }
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

  async getPendingRideRequest(req: Request, res: Response, next: NextFunction) {
    try {
      const request = await driverService.getPendingRideRequest(req.user!.userId);
      res.json({ success: true, data: request });
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

  async getNearbyStands(req: Request, res: Response, next: NextFunction) {
    try {
      const lat = parseFloat(req.query.lat as string);
      const lng = parseFloat(req.query.lng as string);
      const city = (req.query.city as string) || 'taliparamba';
      if (isNaN(lat) || isNaN(lng)) {
        res.status(400).json({ success: false, error: { message: 'lat and lng are required' } });
        return;
      }
      const stands = await driverService.getNearbyStands(lat, lng, city);
      res.json({ success: true, data: stands });
    } catch (err) {
      next(err);
    }
  }

  async getQueueStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const status = await driverService.getQueueStatus(req.user!.userId);
      res.json({ success: true, data: status });
    } catch (err) {
      next(err);
    }
  }

  async setHomeLocation(req: Request, res: Response, next: NextFunction) {
    try {
      const { lat, lng, address } = req.body;
      const result = await driverService.setHomeLocation(req.user!.userId, { lat, lng, address });
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async toggleGoHomeMode(req: Request, res: Response, next: NextFunction) {
    try {
      const { active } = req.body;
      const result = await driverService.toggleGoHomeMode(req.user!.userId, !!active);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async getDailyEarnings(req: Request, res: Response, next: NextFunction) {
    try {
      const days = parseInt((req.query.days as string) || '7', 10);
      const result = await driverService.getDailyEarnings(req.user!.userId, days);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async redeemCoins(req: Request, res: Response, next: NextFunction) {
    try {
      const { planId } = req.body;
      const result = await driverService.redeemCoins(req.user!.userId, planId);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async getLeaderboard(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await driverService.getLeaderboard(req.user!.userId);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async getDemandHeatmap(req: Request, res: Response, next: NextFunction) {
    try {
      const lat = parseFloat(req.query.lat as string);
      const lng = parseFloat(req.query.lng as string);
      const radiusKm = parseFloat((req.query.radiusKm as string) || '5');
      if (isNaN(lat) || isNaN(lng)) {
        res.status(400).json({ success: false, error: { message: 'lat and lng are required' } });
        return;
      }
      const data = await driverService.getDemandHeatmap(lat, lng, radiusKm);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
}

export const driverController = new DriverController();
