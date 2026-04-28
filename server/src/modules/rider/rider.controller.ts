import { Request, Response, NextFunction } from 'express';
import { riderService } from './rider.service';

export class RiderController {
  async getProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const profile = await riderService.getProfile(req.user!.userId);
      res.json({ success: true, data: profile });
    } catch (err) {
      next(err);
    }
  }

  async updateProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const profile = await riderService.updateProfile(req.user!.userId, req.body);
      res.json({ success: true, data: profile });
    } catch (err) {
      next(err);
    }
  }

  async getSavedPlaces(req: Request, res: Response, next: NextFunction) {
    try {
      const places = await riderService.getSavedPlaces(req.user!.userId);
      res.json({ success: true, data: places });
    } catch (err) {
      next(err);
    }
  }

  async addSavedPlace(req: Request, res: Response, next: NextFunction) {
    try {
      const place = await riderService.addSavedPlace(req.user!.userId, req.body);
      res.status(201).json({ success: true, data: place });
    } catch (err) {
      next(err);
    }
  }

  async deleteSavedPlace(req: Request, res: Response, next: NextFunction) {
    try {
      const placeId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      await riderService.deleteSavedPlace(req.user!.userId, placeId);
      res.json({ success: true, data: { message: 'Place deleted' } });
    } catch (err) {
      next(err);
    }
  }

  async getEmergencyContacts(req: Request, res: Response, next: NextFunction) {
    try {
      const contacts = await riderService.getEmergencyContacts(req.user!.userId);
      res.json({ success: true, data: contacts });
    } catch (err) {
      next(err);
    }
  }

  async addEmergencyContact(req: Request, res: Response, next: NextFunction) {
    try {
      const contact = await riderService.addEmergencyContact(req.user!.userId, req.body);
      res.status(201).json({ success: true, data: contact });
    } catch (err) {
      next(err);
    }
  }

  async deleteEmergencyContact(req: Request, res: Response, next: NextFunction) {
    try {
      const contactId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      await riderService.deleteEmergencyContact(req.user!.userId, contactId);
      res.json({ success: true, data: { message: 'Contact deleted' } });
    } catch (err) {
      next(err);
    }
  }

  async triggerSOS(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await riderService.triggerSOS(req.user!.userId, req.body.rideId);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async getRideHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const result = await riderService.getRideHistory(req.user!.userId, page, limit);
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }
}

export const riderController = new RiderController();
