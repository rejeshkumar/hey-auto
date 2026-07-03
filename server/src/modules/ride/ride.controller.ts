import { Request, Response, NextFunction } from 'express';
import { rideService } from './ride.service';
import { redis } from '../../config/redis';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
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

  async getActiveRide(req: Request, res: Response, next: NextFunction) {
    try {
      const ride = await rideService.getActiveRide(req.user!.userId);
      res.json({ success: true, data: ride });
    } catch (err) {
      next(err);
    }
  }

  async getRiderActiveRide(req: Request, res: Response, next: NextFunction) {
    try {
      const ride = await rideService.getRiderActiveRide(req.user!.userId);
      res.json({ success: true, data: ride });
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

  // GET /rides/:id/cancel-preview — returns whether a cancellation charge applies
  async getCancelPreview(req: Request, res: Response, next: NextFunction) {
    try {
      const rideId = paramId(req);
      const { prisma } = await import('../../config/database');
      const ride = await prisma.ride.findUnique({ where: { id: rideId } });
      if (!ride || ride.riderId !== req.user!.userId) {
        res.status(404).json({ success: false, error: { message: 'Ride not found' } });
        return;
      }

      if (ride.status !== 'DRIVER_ASSIGNED' || !ride.acceptedAt) {
        res.json({ success: true, data: { chargeApplies: false, amount: 0 } });
        return;
      }

      const fareConfig = await prisma.fareConfig.findFirst({
        where: { city: ride.city, isActive: true },
        orderBy: { effectiveFrom: 'desc' },
      });
      const chargeEnabled = fareConfig?.cancellationChargeEnabled ?? true;
      const chargeAmount = fareConfig?.cancellationChargeAmount ?? 20;
      const gracePeriodMin = fareConfig?.cancellationGracePeriodMin ?? 3;
      const waitedMin = (Date.now() - ride.acceptedAt.getTime()) / 60000;
      const chargeApplies = chargeEnabled && waitedMin >= gracePeriodMin;

      res.json({
        success: true,
        data: {
          chargeApplies,
          amount: chargeApplies ? chargeAmount : 0,
          waitedMin: Math.round(waitedMin * 10) / 10,
          gracePeriodMin,
        },
      });
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
        const baseUrl = 'https://' + req.get('host');
        res.json({ success: true, data: { url: `${baseUrl}/track/${existing}` } });
        return;
      }

      const token = crypto.randomBytes(16).toString('hex');
      await redis.setex(`${SHARE_TOKEN_PREFIX}${token}`, SHARE_TTL_SEC, rideId);
      await redis.setex(`${SHARE_RIDE_PREFIX}${rideId}`, SHARE_TTL_SEC, token);

      const baseUrl = 'https://' + req.get('host');
      const trackUrl = `${baseUrl}/track/${token}`;

      // Notify emergency contacts via SMS (fire-and-forget)
      notifyEmergencyContacts(req.user!.userId, trackUrl).catch(() => {});

      res.json({ success: true, data: { url: trackUrl } });
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

  // GET /api/v1/rides/track/:token/map  — proxies the Google Static Map image (public, no auth)
  // The Maps key stays server-side and is never sent to the browser. Coordinates are looked up
  // fresh on each request so the driver marker tracks the live position.
  async getTrackMap(req: Request, res: Response, next: NextFunction) {
    try {
      if (!env.GOOGLE_MAPS_API_KEY) {
        // No key configured — let the page fall back to its placeholder
        res.status(404).end();
        return;
      }

      const token = req.params.token as string;
      const rideId = await redis.get(`${SHARE_TOKEN_PREFIX}${token}`);
      if (!rideId) {
        res.status(404).end();
        return;
      }

      const { prisma } = await import('../../config/database');
      const ride = await prisma.ride.findUnique({
        where: { id: rideId },
        select: {
          pickupLat: true, pickupLng: true,
          dropoffLat: true, dropoffLng: true,
          driver: { select: { driverProfile: { select: { currentLat: true, currentLng: true } } } },
        },
      });
      if (!ride) {
        res.status(404).end();
        return;
      }

      const driverLat = ride.driver?.driverProfile?.currentLat ?? null;
      const driverLng = ride.driver?.driverProfile?.currentLng ?? null;
      const hasDriver = driverLat != null && driverLng != null;
      const center = hasDriver
        ? `${driverLat},${driverLng}`
        : `${ride.pickupLat},${ride.pickupLng}`;

      // Build manually — encoding | as %7C breaks Google Static Maps
      const parts = [
        `center=${center}`,
        'zoom=15',
        'size=640x400',
        'scale=2',
        'maptype=roadmap',
        `key=${env.GOOGLE_MAPS_API_KEY}`,
      ];
      if (hasDriver) parts.push(`markers=color:0xF5C800|label:D|${driverLat},${driverLng}`);
      parts.push(`markers=color:0x00C853|label:P|${ride.pickupLat},${ride.pickupLng}`);
      parts.push(`markers=color:0xFF3B30|label:X|${ride.dropoffLat},${ride.dropoffLng}`);

      const mapUrl = `https://maps.googleapis.com/maps/api/staticmap?${parts.join('&')}`;

      const upstream = await globalThis.fetch(mapUrl);
      if (!upstream.ok) {
        logger.warn({ status: upstream.status }, 'Static map upstream error');
        res.status(502).end();
        return;
      }

      const contentType = upstream.headers.get('content-type') ?? 'image/png';
      const buf = Buffer.from(await upstream.arrayBuffer());
      res.set('Content-Type', contentType);
      res.set('Cache-Control', 'private, max-age=4'); // matches ~5s client poll; avoids hammering Google
      res.send(buf);
    } catch (err) {
      next(err);
    }
  }

}

async function notifyEmergencyContacts(riderId: string, trackUrl: string): Promise<void> {
  if (!env.FAST2SMS_API_KEY) return;
  const { prisma } = await import('../../config/database');
  const contacts = await prisma.emergencyContact.findMany({ where: { userId: riderId } });
  if (contacts.length === 0) return;
  for (const contact of contacts) {
    const digits = contact.phone.replace(/^\+91/, '').replace(/\D/g, '');
    if (digits.length !== 10) continue;
    try {
      await fetch('https://www.fast2sms.com/dev/bulkV2', {
        method: 'POST',
        headers: { authorization: env.FAST2SMS_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          route: 'q',
          message: `Aye Auto: Your contact has shared a live trip with you. Track here: ${trackUrl}`,
          numbers: digits,
        }),
      });
      logger.info({ digits: digits.slice(-4) }, 'FollowRide SMS sent to emergency contact');
    } catch (err) {
      logger.warn({ err, digits: digits.slice(-4) }, 'FollowRide SMS failed');
    }
  }
}

export const rideController = new RideController();
