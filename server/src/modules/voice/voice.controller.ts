import { Request, Response } from 'express';
import { processVoiceAudio } from './voice.service';
import { mapsService } from '../../services/maps';
import { logger } from '../../utils/logger';

export const voiceController = {

  // POST /api/v1/voice/tts — convert text to Sarvam speech
  async tts(req: Request, res: Response) {
    try {
      const { text, language } = req.body;
      if (!text) return res.status(400).json({ success: false, error: { code: 'NO_TEXT', message: 'text is required' } });

      const { sarvamTTS } = await import('./voice.service');
      const audio = await (sarvamTTS as any)(text, language === 'en' ? 'en-IN' : 'ml-IN');
      return res.json({ success: true, data: { audio } });
    } catch (err: any) {
      return res.json({ success: true, data: { audio: '' } }); // silent fail — app shows text
    }
  },

  // POST /api/v1/voice/process
  // Body: multipart/form-data — audio file + context + optional pendingDestination
  async process(req: Request, res: Response) {
    try {
      const file = (req as any).file;
      if (!file) {
        return res.status(400).json({ success: false, error: { code: 'NO_AUDIO', message: 'No audio file provided' } });
      }

      const context = (req.body.context as 'initial' | 'confirming') || 'initial';
      const pendingDestination = req.body.pendingDestination as string | undefined;
      const language = (req.body.language as string) || 'ml';

      const result = await processVoiceAudio(
        file.buffer,
        file.mimetype || 'audio/wav',
        context,
        pendingDestination,
        language,
      );

      // If a destination was extracted, try to resolve coordinates via maps
      let resolvedPlace = null;
      if (result.intent.destination && result.intent.intent === 'book_ride') {
        try {
          const searchQuery = result.intent.destinationHint || result.intent.destination;
          const places = await mapsService.searchPlaces(searchQuery, 'voice-session');
          if (places.length > 0) {
            const top = places[0];
            const details = await mapsService.getPlaceDetails(top.placeId, 'voice-session');
            if (details && details.lat !== 0 && details.lng !== 0) {
              resolvedPlace = {
                name:    details.name || top.mainText,
                address: top.secondaryText || top.mainText,
                lat:     details.lat,
                lng:     details.lng,
              };
            }
          }
        } catch (err) {
          logger.warn({ err }, 'Voice: maps resolution failed — will show search screen');
        }
      }

      return res.json({
        success: true,
        data: {
          transcript:          result.transcript,
          intent:              result.intent.intent,
          destination:         result.intent.destination,
          resolvedPlace,
          replyText:           result.intent.replyText,
          replyAudio:          result.replyAudio,       // base64 WAV
          confirmationAnswer:  result.intent.confirmationAnswer,
        },
      });
    } catch (err: any) {
      logger.error({ err }, 'Voice processing error');
      return res.status(500).json({
        success: false,
        error: { code: 'VOICE_ERROR', message: err.message || 'Voice processing failed' },
      });
    }
  },
};
