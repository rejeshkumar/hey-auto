import { Request, Response, NextFunction } from 'express';
import { rideService } from './ride.service';

function paramId(req: Request): string {
  return Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
}

export class RideController {
  async getFareEstimate(req: Request, res: Response, next: NextFunction) {
    try {
      const estimate = await rideService.getFareEstimate(req.body);
      res.json({ success: true, data: estimate });
    } catch (err) {
      next(err);
    }
  }

  async requestRide(req: Request, res: Response, next: NextFunction) {
    try {
      const ride = await rideService.requestRide(req.user!.userId, req.body);
      res.status(201).json({ success: true, data: ride });
    } catch (err) {
      next(err);
    }
  }

  async getRideDetails(req: Request, res: Response, next: NextFunction) {
    try {
      const ride = await rideService.getRideDetails(req.user!.userId, paramId(req));
      res.json({ success: true, data: ride });
    } catch (err) {
      next(err);
    }
  }

  async cancelRide(req: Request, res: Response, next: NextFunction) {
    try {
      const ride = await rideService.cancelRide(
        req.user!.userId,
        paramId(req),
        req.body,
        req.user!.role as 'RIDER' | 'DRIVER',
      );
      res.json({ success: true, data: ride });
    } catch (err) {
      next(err);
    }
  }

  async rateRide(req: Request, res: Response, next: NextFunction) {
    try {
      const rating = await rideService.rateRide(req.user!.userId, paramId(req), req.body);
      res.status(201).json({ success: true, data: rating });
    } catch (err) {
      next(err);
    }
  }

  async acceptRide(req: Request, res: Response, next: NextFunction) {
    try {
      const ride = await rideService.acceptRide(req.user!.userId, paramId(req));
      res.json({ success: true, data: ride });
    } catch (err) {
      next(err);
    }
  }

  async declineRide(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await rideService.declineRide(req.user!.userId, paramId(req));
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async driverArrived(req: Request, res: Response, next: NextFunction) {
    try {
      const ride = await rideService.driverArrived(req.user!.userId, paramId(req));
      res.json({ success: true, data: ride });
    } catch (err) {
      next(err);
    }
  }

  async verifyRideOtp(req: Request, res: Response, next: NextFunction) {
    try {
      const { otp } = req.body;
      const ride = await rideService.verifyRideOtp(req.user!.userId, paramId(req), otp);
      res.json({ success: true, data: ride });
    } catch (err) {
      next(err);
    }
  }

  async startRide(req: Request, res: Response, next: NextFunction) {
    try {
      const ride = await rideService.startRide(req.user!.userId, paramId(req));
      res.json({ success: true, data: ride });
    } catch (err) {
      next(err);
    }
  }

  async completeRide(req: Request, res: Response, next: NextFunction) {
    try {
      const ride = await rideService.completeRide(req.user!.userId, paramId(req));
      res.json({ success: true, data: ride });
    } catch (err) {
      next(err);
    }
  }
}

export const rideController = new RideController();
