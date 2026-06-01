import Anthropic from '@anthropic-ai/sdk';
import FormData from 'form-data';
import fetch from 'node-fetch';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Sarvam AI helpers ────────────────────────────────────────────────────────

async function sarvamSTT(audioBuffer: Buffer, mimeType: string): Promise<string> {
  if (!env.SARVAM_API_KEY) throw new Error('SARVAM_API_KEY not configured');

  const form = new FormData();
  form.append('file', audioBuffer, { filename: 'audio.wav', contentType: mimeType });
  form.append('model', 'saarika:v2');       // Sarvam's best Malayalam model
  form.append('language_code', 'ml-IN');
  form.append('with_timestamps', 'false');

  const res = await fetch('https://api.sarvam.ai/speech-to-text', {
    method: 'POST',
    headers: { 'api-subscription-key': env.SARVAM_API_KEY, ...form.getHeaders() },
    body: form,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Sarvam STT failed: ${res.status} — ${err}`);
  }

  const data = await res.json() as any;
  return (data.transcript || '').trim();
}

export async function sarvamTTS(text: string, languageCode = 'ml-IN'): Promise<string> {
  if (!env.SARVAM_API_KEY) throw new Error('SARVAM_API_KEY not configured');

  const res = await fetch('https://api.sarvam.ai/text-to-speech', {
    method: 'POST',
    headers: {
      'api-subscription-key': env.SARVAM_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: [text],
      target_language_code: languageCode,
      speaker: 'anushka',
      pitch: 0,
      pace: 1.0,
      loudness: 1.5,
      speech_sample_rate: 22050,
      enable_preprocessing: true,
      model: 'bulbul:v2',
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Sarvam TTS failed: ${res.status} — ${err}`);
  }

  const data = await res.json() as any;
  // Sarvam returns base64 WAV
  return data.audios?.[0] || '';
}

// ── Claude NLU ───────────────────────────────────────────────────────────────

interface VoiceIntent {
  intent: 'book_ride' | 'cancel' | 'confirm' | 'unclear';
  destination?: string;           // raw text extracted
  destinationHint?: string;       // search-friendly version for maps API
  confirmationAnswer?: 'yes' | 'no';
  replyText: string;              // what to say back to the user (Malayalam)
  replyTextEn: string;            // English version for logging
}

export async function extractIntent(
  transcript: string,
  context: 'initial' | 'confirming',
  pendingDestination?: string,
  language = 'ml',
): Promise<VoiceIntent> {

  const isML = language === 'ml';

  const systemPrompt = `You are the voice assistant for Hey Auto, a ride-booking app in Kerala, India.
The user speaks in ${isML ? 'Malayalam (or a mix of Malayalam and English)' : 'English (or a mix of English and Malayalam)'}.
Respond warmly in ${isML ? 'Malayalam' : 'English'}.

Rules:
- Extract destinations from natural speech. Examples:
  "ആശുപത്രിയിൽ പോകണം" → destination: "ആശുപത്രി", destinationHint: "hospital taliparamba"
  "Bus stand-ലേക്ക്" → destination: "ബസ് സ്റ്റാൻഡ്", destinationHint: "bus stand taliparamba"
  "Take me to hospital" → destination: "Hospital", destinationHint: "hospital taliparamba"
  "Railway station" → destination: "Railway Station", destinationHint: "kannur railway station"
  "Govt hospital" → destination: "Govt Hospital", destinationHint: "government hospital taliparamba"
- If context is "confirming", detect yes/no:
  Yes: "ആവട്ടെ","ശരി","okay","yes","ha","correct","right"
  No: "വേണ്ട","no","cancel","wrong","different"
- replyText: short, warm, conversational ${isML ? 'Malayalam' : 'English'} (under 20 words).
- replyTextEn: English translation for logging only.
- If unclear, ask a simple follow-up in ${isML ? 'Malayalam' : 'English'}.

Respond ONLY with valid JSON matching the VoiceIntent schema.`;

  const userMsg = context === 'confirming'
    ? `The user previously said they want to go to "${pendingDestination}". Now they replied: "${transcript}"`
    : `The user said: "${transcript}"`;

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',   // fast + cheap for voice NLU
    max_tokens: 300,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMsg }],
  });

  const raw = (response.content[0] as any).text?.trim() || '{}';

  try {
    // Strip markdown code fences if present
    const json = raw.replace(/^```json\n?/, '').replace(/\n?```$/, '');
    return JSON.parse(json) as VoiceIntent;
  } catch {
    logger.warn({ raw }, 'Claude voice NLU returned invalid JSON — defaulting to unclear');
    return {
      intent: 'unclear',
      replyText: 'ക്ഷമിക്കണം, മനസ്സിലായില്ല. വീണ്ടും പറയൂ.',
      replyTextEn: 'Sorry, I did not understand. Please try again.',
    };
  }
}

// ── Main voice processing pipeline ──────────────────────────────────────────

export interface VoiceProcessResult {
  transcript: string;
  intent: VoiceIntent;
  replyAudio: string;   // base64 WAV — play this back on device
}

export async function processVoiceAudio(
  audioBuffer: Buffer,
  mimeType: string,
  context: 'initial' | 'confirming',
  pendingDestination?: string,
  language = 'ml',
): Promise<VoiceProcessResult> {

  const languageCode = language === 'en' ? 'en-IN' : 'ml-IN';

  // Step 1: Speech → Text (Sarvam STT)
  let transcript: string;
  if (env.SARVAM_API_KEY && mimeType !== 'text/plain') {
    transcript = await sarvamSTT(audioBuffer, mimeType);
  } else {
    transcript = audioBuffer.toString('utf8');
  }

  logger.info({ transcript: transcript.slice(0, 60), context, language }, 'Voice STT result');

  // Step 2: NLU — extract intent (Claude), language-aware
  const intent = await extractIntent(transcript, context, pendingDestination, language);

  logger.info({ intent: intent.intent, dest: intent.destination, replyEn: intent.replyTextEn }, 'Voice NLU result');

  // Step 3: Text → Speech (Sarvam TTS), language-aware
  let replyAudio = '';
  if (env.SARVAM_API_KEY) {
    replyAudio = await sarvamTTS(intent.replyText, languageCode);
  }

  return { transcript, intent, replyAudio };
}
