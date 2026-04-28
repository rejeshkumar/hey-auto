import { Server, Socket } from 'socket.io';
import { authenticateSocket } from '../middleware/auth';
import { redisSub } from '../config/redis';
import { driverService } from '../modules/driver/driver.service';
import { logger } from '../utils/logger';

const userSockets = new Map<string, Socket>();

export function setupSocketHandlers(io: Server) {
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
    if (!token) {
      return next(new Error('Authentication required'));
    }

    const user = await authenticateSocket(token);
    if (!user) {
      return next(new Error('Invalid token'));
    }

    (socket as any).user = user;
    next();
  });

  io.on('connection', (socket) => {
    const user = (socket as any).user;
    userSockets.set(user.userId, socket);

    logger.info({ userId: user.userId, role: user.role }, 'Socket connected');

    socket.join(`user:${user.userId}`);
    if (user.role === 'DRIVER') {
      socket.join('drivers');
    }

    // Driver location updates (every 3 seconds)
    socket.on('driver:location_update', async (data: { lat: number; lng: number }) => {
      if (user.role !== 'DRIVER') return;
      try {
        await driverService.updateLocation(user.userId, data);
        const activeRide = await getActiveRideForDriver(user.userId);
        if (activeRide) {
          io.to(`user:${activeRide.riderId}`).emit('ride:driver_location', {
            rideId: activeRide.id,
            lat: data.lat,
            lng: data.lng,
          });
        }
      } catch (err) {
        logger.error({ err, userId: user.userId }, 'Location update failed');
      }
    });

    // Rider requests nearby drivers for map display
    socket.on('rider:nearby_drivers', async (data: { lat: number; lng: number }) => {
      if (user.role !== 'RIDER') return;
      try {
        const drivers = await driverService.getNearbyDrivers(data.lat, data.lng, 3);
        socket.emit('nearby_drivers', drivers.map((d) => ({ lat: d.lat, lng: d.lng, distance: d.distance })));
      } catch (err) {
        logger.error({ err }, 'Nearby drivers query failed');
      }
    });

    socket.on('disconnect', () => {
      userSockets.delete(user.userId);
      logger.info({ userId: user.userId }, 'Socket disconnected');
    });
  });

  // Subscribe to Redis pub/sub for ride events
  redisSub.subscribe('ride_events', (err) => {
    if (err) {
      logger.error({ err }, 'Failed to subscribe to ride_events');
      return;
    }
    logger.info('Subscribed to ride_events channel');
  });

  redisSub.on('message', (_channel, message) => {
    try {
      const event = JSON.parse(message);

      switch (event.type) {
        case 'ride:new_request':
          io.to(`user:${event.driverId}`).emit('ride:new_request', {
            rideId: event.rideId,
            pickupLat: event.pickupLat,
            pickupLng: event.pickupLng,
            pickupAddress: event.pickupAddress,
            dropoffAddress: event.dropoffAddress,
            estimatedFare: event.estimatedFare,
            distance: event.distance,
            riderName: event.riderName,
            riderPhone: event.riderPhone,
            timeoutSec: 15,
          });
          break;

        case 'ride:driver_assigned':
          io.to(`user:${event.riderId}`).emit('ride:driver_assigned', {
            rideId: event.rideId,
            driverId: event.driverId,
            driverName: event.driverName,
            driverPhone: event.driverPhone,
            driverRating: event.driverRating,
            vehicleRegistrationNo: event.vehicleRegistrationNo,
            vehicleColor: event.vehicleColor,
            vehicleModel: event.vehicleModel,
            driverLat: event.driverLat,
            driverLng: event.driverLng,
          });
          break;

        case 'ride:driver_arrived':
          io.to(`user:${event.riderId}`).emit('ride:driver_arrived', {
            rideId: event.rideId,
            rideOtp: event.rideOtp,
          });
          break;

        case 'ride:started':
          io.to(`user:${event.riderId}`).emit('ride:started', { rideId: event.rideId });
          break;

        case 'ride:completed':
          io.to(`user:${event.riderId}`).emit('ride:completed', {
            rideId: event.rideId,
            actualFare: event.actualFare,
            totalAmount: event.totalAmount,
            actualDistanceKm: event.actualDistanceKm,
            actualDurationMin: event.actualDurationMin,
            paymentMethod: event.paymentMethod,
          });
          io.to(`user:${event.driverId}`).emit('ride:completed', {
            rideId: event.rideId,
            totalAmount: event.totalAmount,
          });
          break;

        case 'ride:cancelled':
          if (event.riderId) {
            io.to(`user:${event.riderId}`).emit('ride:cancelled', {
              rideId: event.rideId,
              cancelledBy: event.cancelledBy,
              reason: event.reason,
            });
          }
          if (event.driverId) {
            io.to(`user:${event.driverId}`).emit('ride:cancelled', {
              rideId: event.rideId,
              cancelledBy: event.cancelledBy,
            });
          }
          break;

        case 'ride:no_drivers':
          io.to(`user:${event.riderId}`).emit('ride:no_drivers', {
            rideId: event.rideId,
          });
          break;
      }
    } catch (err) {
      logger.error({ err, message }, 'Failed to process ride event');
    }
  });
}

async function getActiveRideForDriver(driverId: string) {
  const { prisma } = await import('../config/database');
  return prisma.ride.findFirst({
    where: {
      driverId,
      status: { in: ['DRIVER_ASSIGNED', 'DRIVER_ARRIVED', 'OTP_VERIFIED', 'IN_PROGRESS'] },
    },
    select: { id: true, riderId: true },
  });
}
