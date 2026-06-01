import { Request, Response, NextFunction } from 'express';
import { rideService } from './ride.service';
import { redis } from '../../config/redis';
import crypto from 'crypto';

const SHARE_TOKEN_PREFIX = 'share_token:';
const SHARE_RIDE_PREFIX  = 'share_ride:';
const SHARE_TTL_SEC      = 4 * 60 * 60; // 4 hours

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

  // POST /rides/:id/share  — generates a short-lived share token (rider only)
  async createShareToken(req: Request, res: Response, next: NextFunction) {
    try {
      const rideId = paramId(req);
      // getRideDetails throws if the user is not the rider or driver
      const ride = await rideService.getRideDetails(req.user!.userId, rideId);
      if ((ride as any).riderId !== req.user!.userId) {
        res.status(403).json({ success: false, error: { message: 'Only the rider can share this trip' } });
        return;
      }

      // Re-use existing token if still valid
      const existing = await redis.get(`${SHARE_RIDE_PREFIX}${rideId}`);
      if (existing) {
        const baseUrl = req.protocol + '://' + req.get('host');
        res.json({ success: true, data: { url: `${baseUrl}/track/${existing}` } });
        return;
      }

      const token = crypto.randomBytes(16).toString('hex');
      await redis.setex(`${SHARE_TOKEN_PREFIX}${token}`, SHARE_TTL_SEC, rideId);
      await redis.setex(`${SHARE_RIDE_PREFIX}${rideId}`, SHARE_TTL_SEC, token);

      const baseUrl = req.protocol + '://' + req.get('host');
      res.json({ success: true, data: { url: `${baseUrl}/track/${token}` } });
    } catch (err) {
      next(err);
    }
  }

  // GET /api/v1/track/:token  — returns live ride JSON (public, no auth)
  async getTrackData(req: Request, res: Response, next: NextFunction) {
    try {
      const token = req.params.token as string;
      const rideId = await redis.get(`${SHARE_TOKEN_PREFIX}${token}`);
      if (!rideId) {
        res.status(404).json({ success: false, error: { message: 'Tracking link expired or invalid' } });
        return;
      }

      const ride = await (async () => {
        const { prisma } = await import('../../config/database');
        return prisma.ride.findUnique({
          where: { id: rideId },
          select: {
            id: true, status: true,
            pickupLat: true, pickupLng: true, pickupAddress: true,
            dropoffLat: true, dropoffLng: true, dropoffAddress: true,
            estimatedFare: true, estimatedDistanceKm: true,
            driverId: true,
            driver: { select: { fullName: true, driverProfile: { select: { currentLat: true, currentLng: true, vehicles: { where: { isActive: true }, select: { registrationNo: true, color: true, model: true }, take: 1 } } } } },
          },
        });
      })();

      if (!ride) {
        res.status(404).json({ success: false, error: { message: 'Ride not found' } });
        return;
      }

      res.json({
        success: true,
        data: {
          rideId: ride.id,
          status: ride.status,
          pickupAddress: ride.pickupAddress,
          dropoffAddress: ride.dropoffAddress,
          pickupLat: ride.pickupLat, pickupLng: ride.pickupLng,
          dropoffLat: ride.dropoffLat, dropoffLng: ride.dropoffLng,
          estimatedFare: ride.estimatedFare,
          estimatedDistanceKm: ride.estimatedDistanceKm,
          driverName: ride.driver?.fullName ?? null,
          driverLat: ride.driver?.driverProfile?.currentLat ?? null,
          driverLng: ride.driver?.driverProfile?.currentLng ?? null,
          vehicle: ride.driver?.driverProfile?.vehicles?.[0] ?? null,
        },
      });
    } catch (err) {
      next(err);
    }
  }
}

export const rideController = new RideController();
