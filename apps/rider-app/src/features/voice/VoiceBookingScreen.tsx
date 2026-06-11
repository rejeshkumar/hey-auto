import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Easing,
  Platform, Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors, typography, spacing, borderRadius } from '../../theme';
import { useRideStore } from '../../hooks/useRideStore';
import { useLocationStore } from '../../hooks/useLocationStore';
import { api } from '../../services/api';

const TALIPARAMBA = { lat: 12.9716, lng: 77.5946 };
const SILENCE_TIMEOUT_MS = 3000; // auto-stop recording after 3s of user not releasing

interface ResolvedPlace { name: string; address: string; lat: number; lng: number; }
interface ChatMessage  { role: 'bot' | 'user'; text: string; }

type ConvState =
  | 'greeting'     // playing welcome message
  | 'listening'    // actively recording
  | 'processing'   // server processing
  | 'speaking'     // playing bot TTS reply
  | 'confirming'   // waiting for yes/no
  | 'done';        // ride confirmed, navigating

const STRINGS = {
  en: {
    title:         'Hey Auto',
    sub:           'Voice Assistant',
    welcome:       'Hello! Welcome to Hey Auto. Where would you like to go?',
    listening:     'Listening...',
    thinking:      'Just a moment...',
    tapToSpeak:    'Tap to speak',
    tapToStop:     'Tap to stop',
    searchManual:  'Type instead',
    booking:       'Booking your ride...',
    retry:         'Sorry, I didn\'t catch that. Please try again.',
    confirmYes:    'Yes',
    confirmNo:     'No, change it',
  },
  ml: {
    title:         'Hey Auto',
    sub:           'വോയ്സ് അസിസ്റ്റന്റ്',
    welcome:       'ഹലോ! Hey Auto-ലേക്ക് സ്വാഗതം. എവിടേക്ക് പോകണം?',
    listening:     'കേൾക്കുന്നു...',
    thinking:      'ഒരു നിമിഷം...',
    tapToSpeak:    'സംസാരിക്കാൻ ടാപ്പ് ചെയ്യൂ',
    tapToStop:     'നിർത്താൻ ടാപ്പ് ചെയ്യൂ',
    searchManual:  'ടൈപ്പ് ചെയ്യൂ',
    booking:       'ബുക്ക് ചെയ്യുന്നു...',
    retry:         'ക്ഷമിക്കണം, മനസ്സിലായില്ല. വീണ്ടും പറയൂ.',
    confirmYes:    'ആവട്ടെ',
    confirmNo:     'വേണ്ട, മാറ്റണം',
  },
};

export function VoiceBookingScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { i18n } = useTranslation();
  const lang = i18n.language === 'ml' ? 'ml' : 'en';
  const s = STRINGS[lang];

  const { setPickup, setDropoff, setPhase } = useRideStore();
  const { currentLat, currentLng } = useLocationStore();

  const [convState, setConvState]         = useState<ConvState>('greeting');
  const [messages, setMessages]           = useState<ChatMessage[]>([]);
  const [pendingPlace, setPendingPlace]   = useState<ResolvedPlace | null>(null);
  const [pendingDest, setPendingDest]     = useState<string | undefined>();
  const [statusHint, setStatusHint]       = useState('');

  const recordingRef    = useRef<Audio.Recording | null>(null);
  const soundRef        = useRef<Audio.Sound | null>(null);
  const pulseAnim       = useRef(new Animated.Value(1)).current;
  const pulseLoopRef    = useRef<Animated.CompositeAnimation | null>(null);
  const scrollRef       = useRef<ScrollView>(null);
  const mountedRef      = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    Audio.requestPermissionsAsync().then(({ status }) => {
      if (status !== 'granted') {
        Alert.alert(
          lang === 'ml' ? 'മൈക്രോഫോൺ അനുമതി' : 'Microphone Access',
          lang === 'ml'
            ? 'Settings → Apps → Hey Auto → Permissions → Microphone'
            : 'Please allow microphone access in Settings → Apps → Hey Auto → Permissions',
          [{ text: 'OK' }]
        );
      } else {
        // Start the conversation immediately
        startConversation();
      }
    });
    return () => {
      mountedRef.current = false;
      stopPulse();
      recordingRef.current?.stopAndUnloadAsync().catch(() => {});
      soundRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages]);

  // ── Pulse animation ───────────────────────────────────────────────────────
  const startPulse = () => {
    pulseLoopRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.3, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,   duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    pulseLoopRef.current.start();
  };
  const stopPulse = () => {
    pulseLoopRef.current?.stop();
    pulseAnim.setValue(1);
  };

  // ── TTS playback ──────────────────────────────────────────────────────────
  const speak = async (text: string): Promise<void> => {
    try {
      const { data: res } = await api.post('/voice/tts', { text, language: lang });
      if (!res.success || !res.data.audio) return;
      const uri = `${FileSystem.cacheDirectory}bot_reply_${Date.now()}.wav`;
      await FileSystem.writeAsStringAsync(uri, res.data.audio, { encoding: FileSystem.EncodingType.Base64 });
      // Force speaker output — not earpiece — so user hears without holding to ear
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false, // always use speaker on Android
      });
      if (soundRef.current) { await soundRef.current.unloadAsync().catch(() => {}); }
      const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true, volume: 1.0 });
      soundRef.current = sound;
      await sound.playAsync();
      // Wait for playback to finish before returning
      await new Promise<void>(resolve => {
        sound.setOnPlaybackStatusUpdate((st: any) => {
          if (st.didJustFinish || st.error) {
            sound.unloadAsync().catch(() => {});
            resolve();
          }
        });
      });
    } catch {
      // Silently fall through — text bubble is already shown
    }
  };

  // ── Add message to chat ───────────────────────────────────────────────────
  const addMessage = (role: 'bot' | 'user', text: string) => {
    setMessages(prev => [...prev, { role, text }]);
  };

  // ── Start the whole conversation ──────────────────────────────────────────
  const startConversation = async () => {
    if (!mountedRef.current) return;
    addMessage('bot', s.welcome);
    setConvState('speaking');
    setStatusHint('');
    await speak(s.welcome);
    if (!mountedRef.current) return;
    setConvState('listening');
    setStatusHint(s.tapToSpeak);
  };

  // ── Start recording ───────────────────────────────────────────────────────
  const startListening = async () => {
    if (convState !== 'listening') return;
    try {
      if (recordingRef.current) {
        await recordingRef.current.stopAndUnloadAsync().catch(() => {});
        recordingRef.current = null;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      startPulse();
      setStatusHint(s.tapToStop);
    } catch (e: any) {
      Alert.alert('Microphone Error', e?.message || 'Could not start recording.');
    }
  };

  // ── Stop recording & process ──────────────────────────────────────────────
  const stopListening = async () => {
    if (!recordingRef.current) return;
    stopPulse();
    setConvState('processing');
    setStatusHint(s.thinking);

    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      if (!uri) throw new Error('No recording URI');

      const formData = new FormData();
      formData.append('audio', { uri, name: 'voice.m4a', type: 'audio/m4a' } as any);
      formData.append('context', convState === 'confirming' ? 'confirming' : 'initial');
      formData.append('language', lang);
      if (pendingDest) formData.append('pendingDestination', pendingDest);

      const { data: res } = await api.post('/voice/process', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (!res.success) throw new Error(res.error?.message || 'Processing failed');

      await processResponse(res.data);
    } catch {
      if (!mountedRef.current) return;
      addMessage('bot', s.retry);
      setConvState('speaking');
      await speak(s.retry);
      if (!mountedRef.current) return;
      setConvState('listening');
      setStatusHint(s.tapToSpeak);
    }
  };

  // ── Process server response & continue conversation ───────────────────────
  const processResponse = async (data: any) => {
    if (!mountedRef.current) return;

    // Show what user said
    if (data.transcript) addMessage('user', data.transcript);

    // Show bot reply
    const replyText = data.replyText || '';

    if (data.intent === 'book_ride' && data.resolvedPlace) {
      // Destination found — show confirmation
      setPendingDest(data.destination);
      setPendingPlace(data.resolvedPlace);
      addMessage('bot', replyText || (lang === 'ml'
        ? `${data.resolvedPlace.name}-ലേക്ക് ബുക്ക് ചെയ്യട്ടെ?`
        : `Shall I book a ride to ${data.resolvedPlace.name}?`));
      setConvState('speaking');
      await speak(replyText || (lang === 'ml'
        ? `${data.resolvedPlace.name}-ലേക്ക് ബുക്ക് ചെയ്യട്ടെ?`
        : `Shall I book a ride to ${data.resolvedPlace.name}?`));
      if (!mountedRef.current) return;
      setConvState('confirming');
      setStatusHint(lang === 'ml' ? '"ആവട്ടെ" അല്ലെങ്കിൽ "വേണ്ട"' : '"Yes" or "No"');

    } else if (data.intent === 'book_ride' && data.destination) {
      // Heard destination but couldn't resolve coords
      addMessage('bot', replyText);
      setConvState('speaking');
      await speak(replyText);
      if (!mountedRef.current) return;
      setConvState('listening');
      setStatusHint(s.tapToSpeak);

    } else if (data.intent === 'confirm' && data.confirmationAnswer === 'yes' && pendingPlace) {
      // Confirmed — book
      const confirmMsg = lang === 'ml' ? 'ശരി! ബുക്ക് ചെയ്യുന്നു...' : 'Great! Booking your ride now...';
      addMessage('bot', confirmMsg);
      setConvState('speaking');
      await speak(confirmMsg);
      if (!mountedRef.current) return;
      setConvState('done');
      setPickup({
        lat: currentLat || TALIPARAMBA.lat,
        lng: currentLng || TALIPARAMBA.lng,
        address: lang === 'ml' ? 'നിലവിലെ സ്ഥാനം' : 'Current Location',
      });
      setDropoff({ lat: pendingPlace.lat, lng: pendingPlace.lng, address: pendingPlace.name });
      setPhase('reviewing_estimate');
      setTimeout(() => navigation.replace('BookingConfirm'), 600);

    } else if (data.intent === 'confirm' && data.confirmationAnswer === 'no') {
      // User said no — ask again
      const askAgain = lang === 'ml' ? 'ശരി. വേറെ എവിടേക്ക് വേണം?' : 'OK. Where would you like to go?';
      setPendingDest(undefined);
      setPendingPlace(null);
      addMessage('bot', askAgain);
      setConvState('speaking');
      await speak(askAgain);
      if (!mountedRef.current) return;
      setConvState('listening');
      setStatusHint(s.tapToSpeak);

    } else {
      // Unclear — let bot reply guide the user
      if (replyText) {
        addMessage('bot', replyText);
        setConvState('speaking');
        await speak(replyText);
        if (!mountedRef.current) return;
      }
      setConvState('listening');
      setStatusHint(s.tapToSpeak);
    }
  };

  // ── Tap mic button handler ────────────────────────────────────────────────
  const handleMicTap = () => {
    if (convState === 'listening') {
      if (recordingRef.current) {
        stopListening();
      } else {
        startListening();
      }
    } else if (convState === 'confirming') {
      // In confirming state, mic tap starts listening for yes/no
      startListening();
    }
  };

  const isListening  = convState === 'listening';
  const isProcessing = convState === 'processing';
  const isSpeaking   = convState === 'speaking' || convState === 'greeting';
  const isRecording  = !!recordingRef.current;
  const isDone       = convState === 'done';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{s.title}</Text>
          <Text style={styles.headerSub}>{s.sub}</Text>
        </View>
        <TouchableOpacity style={styles.searchBtn} onPress={() => navigation.navigate('Search')}>
          <MaterialCommunityIcons name="magnify" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Chat bubbles */}
      <ScrollView
        ref={scrollRef}
        style={styles.chat}
        contentContainerStyle={styles.chatContent}
        showsVerticalScrollIndicator={false}
      >
        {messages.map((msg, i) => (
          <View key={i} style={[styles.bubble, msg.role === 'user' ? styles.userBubble : styles.botBubble]}>
            {msg.role === 'bot' && (
              <View style={styles.botAvatar}>
                <MaterialCommunityIcons name="robot-happy-outline" size={16} color={colors.primary} />
              </View>
            )}
            <View style={[styles.bubbleInner, msg.role === 'user' ? styles.userBubbleInner : styles.botBubbleInner]}>
              <Text style={[styles.bubbleText, msg.role === 'user' ? styles.userBubbleText : styles.botBubbleText]}>
                {msg.text}
              </Text>
            </View>
          </View>
        ))}

        {/* Pending place card */}
        {pendingPlace && convState === 'confirming' && (
          <View style={styles.placeCard}>
            <View style={styles.placeIcon}>
              <MaterialCommunityIcons name="map-marker" size={20} color={colors.primary} />
            </View>
            <View style={styles.placeInfo}>
              <Text style={styles.placeName}>{pendingPlace.name}</Text>
              <Text style={styles.placeAddr} numberOfLines={1}>{pendingPlace.address}</Text>
            </View>
          </View>
        )}

        {/* Confirm buttons */}
        {convState === 'confirming' && pendingPlace && (
          <View style={styles.confirmRow}>
            <TouchableOpacity style={styles.confirmNo} onPress={() => {
              addMessage('user', s.confirmNo);
              processResponse({ intent: 'confirm', confirmationAnswer: 'no', transcript: s.confirmNo, replyText: '' });
            }}>
              <Text style={styles.confirmNoText}>{s.confirmNo}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmYes} onPress={() => {
              addMessage('user', s.confirmYes);
              processResponse({ intent: 'confirm', confirmationAnswer: 'yes', transcript: s.confirmYes, replyText: '' });
            }}>
              <MaterialCommunityIcons name="check" size={18} color={colors.ink} />
              <Text style={styles.confirmYesText}>{s.confirmYes}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Typing/speaking indicator */}
        {(isProcessing || isSpeaking) && (
          <View style={styles.bubble}>
            <View style={styles.botAvatar}>
              <MaterialCommunityIcons name="robot-happy-outline" size={16} color={colors.primary} />
            </View>
            <View style={styles.botBubbleInner}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          </View>
        )}
      </ScrollView>

      {/* Mic area */}
      {!isDone && (
        <View style={[styles.micArea, { paddingBottom: Math.max(insets.bottom + 16, 24) }]}>
          <Text style={styles.statusHint}>{isSpeaking ? (lang === 'ml' ? 'കേൾക്കൂ...' : 'Listening to reply...') : statusHint}</Text>
          <Animated.View style={[styles.micRing, { transform: [{ scale: pulseAnim }] },
            isRecording && styles.micRingActive]}>
            <TouchableOpacity
              style={[styles.micBtn, isRecording && styles.micBtnActive,
                (isSpeaking || isProcessing) && styles.micBtnDisabled]}
              onPress={handleMicTap}
              disabled={isSpeaking || isProcessing || isDone}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons
                name={isRecording ? 'stop' : isProcessing ? 'loading' : 'microphone'}
                size={36}
                color={isRecording ? colors.ink : isSpeaking || isProcessing ? colors.textLight : colors.primary}
              />
            </TouchableOpacity>
          </Animated.View>
          <Text style={styles.micLabel}>
            {isRecording  ? (lang === 'ml' ? 'നിർത്താൻ ടാപ്പ് ചെയ്യൂ' : 'Tap to stop')  :
             isProcessing ? (lang === 'ml' ? 'ഒരു നിമിഷം...' : 'Processing...')         :
             isSpeaking   ? ''                                                           :
             (lang === 'ml' ? 'ടാപ്പ് ചെയ്ത് സംസാരിക്കൂ' : 'Tap to speak')}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.base, paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  headerSub: { fontSize: 11, color: colors.textSecondary, marginTop: 1 },
  searchBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },

  chat: { flex: 1 },
  chatContent: { padding: spacing.base, gap: spacing.sm, paddingBottom: spacing.lg },

  bubble: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xs },
  botBubble: { alignSelf: 'flex-start', maxWidth: '82%' },
  userBubble: { alignSelf: 'flex-end', flexDirection: 'row-reverse', maxWidth: '82%' },

  botAvatar: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.ink,
    borderWidth: 1.5, borderColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },

  bubbleInner: { borderRadius: 18, padding: spacing.sm + 2 },
  botBubbleInner: {
    backgroundColor: colors.ink,
    borderTopWidth: 2, borderTopColor: colors.primary,
    borderBottomLeftRadius: 4, overflow: 'hidden',
  },
  userBubbleInner: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleText: { fontSize: 15, fontWeight: '500', lineHeight: 22 },
  botBubbleText:  { color: colors.primary },
  userBubbleText: { color: colors.ink, fontWeight: '600' },

  placeCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl, borderWidth: 1.5, borderColor: colors.primary,
    padding: spacing.base, marginVertical: spacing.xs,
  },
  placeIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  placeInfo: { flex: 1 },
  placeName: { fontSize: 14, fontWeight: '700', color: colors.text },
  placeAddr: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },

  confirmRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  confirmNo: {
    flex: 1, padding: spacing.sm + 2, borderRadius: 12,
    backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border,
    alignItems: 'center',
  },
  confirmNoText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  confirmYes: {
    flex: 2, padding: spacing.sm + 2, borderRadius: 12,
    backgroundColor: colors.primary,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    boxShadow: '0 4px 14px rgba(249,176,27,0.3)',
  } as any,
  confirmYesText: { fontSize: 14, fontWeight: '800', color: colors.ink },

  micArea: {
    alignItems: 'center', paddingTop: spacing.base,
    borderTopWidth: 1, borderTopColor: colors.borderLight,
    gap: spacing.xs,
  },
  statusHint: { fontSize: 12, color: colors.textSecondary, height: 16 },

  micRing: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: 'rgba(249,176,27,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  micRingActive: { backgroundColor: 'rgba(249,176,27,0.2)' },

  micBtn: {
    width: 68, height: 68, borderRadius: 34,
    backgroundColor: colors.ink,
    borderTopWidth: 3, borderTopColor: colors.primary,
    overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
    elevation: 6,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3, shadowRadius: 10,
  },
  micBtnActive:   { backgroundColor: colors.primary },
  micBtnDisabled: { opacity: 0.4 },
  micLabel: { fontSize: 11, color: colors.textSecondary, textAlign: 'center', height: 16 },
});
