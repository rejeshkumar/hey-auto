import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database';
import { logger } from '../../utils/logger';
import { BadRequestError } from '../../utils/errors';

export class NomineeController {
  async get(req: Request, res: Response, next: NextFunction) {
    try {
      const nominee = await prisma.dataNominee.findUnique({
        where: { userId: req.user!.userId },
        select: { id: true, name: true, phone: true, relationship: true, updatedAt: true },
      });
      res.json({ success: true, data: nominee ?? null });
    } catch (err) {
      next(err);
    }
  }

  async upsert(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, phone, relationship } = req.body as {
        name: string; phone: string; relationship?: string;
      };

      if (!name?.trim() || name.trim().length < 2) {
        throw new BadRequestError('Nominee name must be at least 2 characters');
      }
      if (!phone?.trim() || !/^\+?[0-9]{10,15}$/.test(phone.trim().replace(/\s/g, ''))) {
        throw new BadRequestError('Valid phone number is required');
      }

      const nominee = await prisma.dataNominee.upsert({
        where: { userId: req.user!.userId },
        create: {
          userId: req.user!.userId,
          name: name.trim(),
          phone: phone.trim().startsWith('+91') ? phone.trim() : `+91${phone.trim().replace(/^\+91/, '')}`,
          relationship: relationship?.trim() || null,
        },
        update: {
          name: name.trim(),
          phone: phone.trim().startsWith('+91') ? phone.trim() : `+91${phone.trim().replace(/^\+91/, '')}`,
          relationship: relationship?.trim() || null,
        },
        select: { id: true, name: true, phone: true, relationship: true, updatedAt: true },
      });

      logger.info({ userId: req.user!.userId }, 'DPDP: nominee updated');
      res.json({ success: true, data: nominee });
    } catch (err) {
      next(err);
    }
  }

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      await prisma.dataNominee.deleteMany({ where: { userId: req.user!.userId } });
      logger.info({ userId: req.user!.userId }, 'DPDP: nominee removed');
      res.json({ success: true, data: { message: 'Nominee removed' } });
    } catch (err) {
      next(err);
    }
  }
}

export const nomineeController = new NomineeController();
