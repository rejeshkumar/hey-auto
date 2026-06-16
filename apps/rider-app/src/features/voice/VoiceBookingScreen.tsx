import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Easing,
  Alert, ActivityIndicator,
} from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../../theme';
import { useRideStore } from '../../hooks/useRideStore';
import { useLocationStore } from '../../hooks/useLocationStore';
import { useAuthStore } from '../../hooks/useAuthStore';
import { api } from '../../services/api';

const TALIPARAMBA = { lat: 12.9716, lng: 77.5946 };

interface ResolvedPlace { name: string; address: string; lat: number; lng: number; }

type Phase =
  | 'greeting'     // speaking welcome
  | 'listening'    // mic open, waiting for speech
  | 'processing'   // sending to server
  | 'confirming'   // showing destination card, waiting for confirm
  | 'booking'      // confirmed, navigating
  | 'error';       // something failed

export function VoiceBookingScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { setPickup, setDropoff, setPhase: setRidePhase } = useRideStore();
  const { currentLat, currentLng } = useLocationStore();
  const user = useAuthStore(s => s.user);
  const firstName = user?.fullName?.split(' ')[0] || 'there';

  const [phase, setPhase]             = useState<Phase>('greeting');
  const [statusText, setStatusText]   = useState('');
  const [place, setPlace]             = useState<ResolvedPlace | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef     = useRef<Audio.Sound | null>(null);
  const pulseAnim    = useRef(new Animated.Value(1)).current;
  const pulseLoop    = useRef<Animated.CompositeAnimation | null>(null);
  const mountedRef   = useRef(true);
  const voiceCtxRef  = useRef<'initial' | 'confirming'>('initial');
  const pendingPlace = useRef<ResolvedPlace | null>(null);
  const lang         = 'ml'; // Malayalam by default

  const greetingText = lang === 'ml'
    ? `ഹലോ ${firstName}! Hey Auto-ലേക്ക് സ്വാഗതം. എവിടേക്ക് പോകണം?`
    : `Hello ${firstName}! Welcome to Hey Auto. Where would you like to go?`;

  useEffect(() => {
    mountedRef.current = true;
    startFlow();
    return () => {
      mountedRef.current = false;
      stopPulse();
      recordingRef.current?.stopAndUnloadAsync().catch(() => {});
      soundRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

  const startPulse = () => {
    pulseLoop.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.25, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    pulseLoop.current.start();
  };

  const stopPulse = () => {
    pulseLoop.current?.stop();
    pulseAnim.setValue(1);
  };

  const speak = async (text: string) => {
    try {
      const { data: res } = await api.post('/voice/tts', { text, language: lang });
      if (!res.success || !res.data?.audio) return;
      const uri = `${FileSystem.cacheDirectory}tts_${Date.now()}.wav`;
      await FileSystem.writeAsStringAsync(uri, res.data.audio, { encoding: FileSystem.EncodingType.Base64 });
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false, playsInSilentModeIOS: true,
        staysActiveInBackground: false, shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
      if (soundRef.current) await soundRef.current.unloadAsync().catch(() => {});
      const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true, volume: 1.0 });
      soundRef.current = sound;
      await new Promise<void>(resolve => {
        sound.setOnPlaybackStatusUpdate((st: any) => {
          if (st.didJustFinish || st.error) { sound.unloadAsync().catch(() => {}); resolve(); }
        });
      });
    } catch { /* fall through silently */ }
  };

  const startFlow = async () => {
    const { status } = await Audio.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Microphone Access Needed', 'Please allow microphone in Settings to use voice booking.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
      return;
    }
    if (!mountedRef.current) return;
    setPhase('greeting');
    setStatusText(lang === 'ml' ? 'സ്വാഗതം...' : 'Welcome...');
    await speak(greetingText);
    if (!mountedRef.current) return;
    await startListeningWithContext('initial');
  };

  const startListening = async () => {
    if (!mountedRef.current) return;
    try {
      if (recordingRef.current) {
        await recordingRef.current.stopAndUnloadAsync().catch(() => {});
        recordingRef.current = null;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true, staysActiveInBackground: false });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      recordingRef.current = recording;
      setPhase('listening');
      setIsRecording(true);
      setStatusText(lang === 'ml' ? 'കേൾക്കുന്നു... സംസാരിക്കൂ' : 'Listening... speak now');
      startPulse();
    } catch {
      setPhase('error');
      setStatusText(lang === 'ml' ? 'മൈക്രോഫോൺ പ്രശ്‌നം' : 'Microphone error');
    }
  };

  const stopListeningAndProcess = async () => {
    if (!recordingRef.current || !mountedRef.current) return;
    stopPulse();
    setIsRecording(false);
    setPhase('processing');
    setStatusText(lang === 'ml' ? 'മനസ്സിലാക്കുന്നു...' : 'Understanding...');

    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      if (!uri) throw new Error('No audio');

      const formData = new FormData();
      formData.append('audio', { uri, name: 'voice.m4a', type: 'audio/m4a' } as any);
      formData.append('language', lang);
      formData.append('context', voiceCtxRef.current);

      const { data: res } = await api.post('/voice/process', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (!res.success) throw new Error('Server error');
      await handleServerResponse(res.data);
    } catch {
      if (!mountedRef.current) return;
      const retry = lang === 'ml' ? 'ക്ഷമിക്കണം, വ്യക്തമായി കേൾക്കാനായില്ല. ഒന്നുകൂടി പറയൂ.' : 'Sorry, I didn\'t catch that. Please try again.';
      setStatusText(retry);
      await speak(retry);
      if (!mountedRef.current) return;
      await startListeningWithContext(voiceCtxRef.current);
    }
  };

  const handleServerResponse = async (data: any) => {
    if (!mountedRef.current) return;

    if (voiceCtxRef.current === 'confirming') {
      // User replied yes/no to confirmation
      const confirmed = data.intent === 'confirm_yes' || (data.transcript && /^(yes|yeah|ok|ആകട്ടെ|ശരി|ഉണ്ട്|അതെ)/i.test(data.transcript));
      const denied    = data.intent === 'confirm_no'  || (data.transcript && /^(no|nope|വേണ്ട|അല്ല|change|മാറ്റ)/i.test(data.transcript));

      if (confirmed && pendingPlace.current) {
        await bookRide(pendingPlace.current);
      } else if (denied) {
        pendingPlace.current = null;
        setPlace(null);
        voiceCtxRef.current = 'initial';
        const msg = lang === 'ml' ? 'ശരി. വേറെ എവിടേക്ക് പോകണം?' : 'OK. Where would you like to go?';
        setStatusText(msg);
        await speak(msg);
        if (!mountedRef.current) return;
        await startListeningWithContext('initial');
      } else {
        // Unclear — ask again
        const again = lang === 'ml' ? 'ഉണ്ടോ, ഇല്ലേ?' : 'Yes or no?';
        setStatusText(again);
        await speak(again);
        if (!mountedRef.current) return;
        await startListeningWithContext('confirming');
      }
      return;
    }

    // initial context — user spoke a destination
    if (data.intent === 'book_ride' && data.resolvedPlace) {
      const p: ResolvedPlace = data.resolvedPlace;
      pendingPlace.current = p;
      setPlace(p);
      setPhase('confirming');
      voiceCtxRef.current = 'confirming';
      const confirmText = lang === 'ml'
        ? `${p.name}-ലേക്ക് ഒരു ഓട്ടോ ബുക്ക് ചെയ്യട്ടെ?`
        : `Shall I book a ride to ${p.name}?`;
      setStatusText(confirmText);
      await speak(confirmText);
      // Auto-listen for yes/no
      if (!mountedRef.current) return;
      await startListeningWithContext('confirming');
    } else {
      const replyText = data.replyText || (lang === 'ml' ? 'ഒന്നുകൂടി പറയൂ?' : 'Could you say that again?');
      setStatusText(replyText);
      await speak(replyText);
      if (!mountedRef.current) return;
      await startListeningWithContext('initial');
    }
  };

  const startListeningWithContext = async (ctx: 'initial' | 'confirming') => {
    voiceCtxRef.current = ctx;
    await startListening();
  };

  const bookRide = async (p: ResolvedPlace) => {
    if (!mountedRef.current) return;
    setPhase('booking');
    const msg = lang === 'ml' ? 'ശരി! ഓട്ടോ ബുക്ക് ചെയ്യുന്നു...' : 'Great! Booking your auto...';
    setStatusText(msg);
    await speak(msg);
    setPickup({
      lat: currentLat || TALIPARAMBA.lat,
      lng: currentLng || TALIPARAMBA.lng,
      address: lang === 'ml' ? 'നിലവിലെ സ്ഥാനം' : 'Current Location',
    });
    setDropoff({ lat: p.lat, lng: p.lng, address: p.name });
    setRidePhase('reviewing_estimate');
    setTimeout(() => navigation.replace('BookingConfirm'), 400);
  };

  const handleTapYes = () => { if (pendingPlace.current) bookRide(pendingPlace.current); };
  const handleTapNo  = async () => {
    pendingPlace.current = null;
    setPlace(null);
    voiceCtxRef.current = 'initial';
    const msg = lang === 'ml' ? 'ശരി. വേറെ എവിടേക്ക് പോകണം?' : 'OK. Where would you like to go?';
    setStatusText(msg);
    await speak(msg);
    if (!mountedRef.current) return;
    await startListeningWithContext('initial');
  };

  const handleMicTap = () => {
    if (phase === 'listening') {
      if (isRecording) stopListeningAndProcess();
      else startListeningWithContext(voiceCtxRef.current);
    }
  };

  const orbColor = phase === 'listening' && isRecording ? colors.primary
    : phase === 'confirming' ? '#22C55E'
    : phase === 'processing' ? colors.textSecondary
    : colors.primary;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Hey Auto</Text>
        <TouchableOpacity style={styles.searchBtn} onPress={() => navigation.navigate('Search')}>
          <MaterialCommunityIcons name="keyboard" size={20} color={colors.primary} />
          <Text style={styles.searchBtnText}>{lang === 'ml' ? 'ടൈപ്പ്' : 'Type'}</Text>
        </TouchableOpacity>
      </View>

      {/* Center orb */}
      <View style={styles.orbArea}>
        <Animated.View style={[styles.orbRing, { transform: [{ scale: pulseAnim }], borderColor: orbColor + '40' }]}>
          <View style={[styles.orb, { backgroundColor: orbColor + '18', borderColor: orbColor }]}>
            {phase === 'processing' || phase === 'greeting' ? (
              <ActivityIndicator size="large" color={orbColor} />
            ) : phase === 'booking' ? (
              <MaterialCommunityIcons name="check-circle" size={52} color="#22C55E" />
            ) : (
              <MaterialCommunityIcons
                name={isRecording ? 'microphone' : phase === 'confirming' ? 'map-marker-check' : 'microphone-outline'}
                size={52}
                color={orbColor}
              />
            )}
          </View>
        </Animated.View>

        <Text style={styles.statusText}>{statusText}</Text>

        {phase === 'listening' && (
          <Text style={styles.hintText}>
            {isRecording
              ? (lang === 'ml' ? 'നിർത്താൻ ടാപ്പ് ചെയ്യൂ' : 'Tap to stop')
              : (lang === 'ml' ? 'ടാപ്പ് ചെയ്ത് സംസാരിക്കൂ' : 'Tap mic to speak')}
          </Text>
        )}
      </View>

      {/* Destination card — shown when confirming */}
      {phase === 'confirming' && place && (
        <View style={styles.placeCard}>
          <View style={styles.placeIconWrap}>
            <MaterialCommunityIcons name="map-marker" size={24} color={colors.primary} />
          </View>
          <View style={styles.placeInfo}>
            <Text style={styles.placeName}>{place.name}</Text>
            <Text style={styles.placeAddr} numberOfLines={1}>{place.address}</Text>
          </View>
        </View>
      )}

      {/* Bottom action area */}
      <View style={[styles.bottomArea, { paddingBottom: Math.max(insets.bottom + 16, 24) }]}>
        {phase === 'listening' && (
          <TouchableOpacity
            style={[styles.micButton, isRecording && styles.micButtonActive]}
            onPress={handleMicTap}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons
              name={isRecording ? 'stop' : 'microphone'}
              size={32}
              color={isRecording ? colors.ink : colors.primary}
            />
          </TouchableOpacity>
        )}

        {phase === 'confirming' && (
          <View style={styles.confirmButtons}>
            <TouchableOpacity style={styles.btnNo} onPress={handleTapNo}>
              <Text style={styles.btnNoText}>{lang === 'ml' ? 'വേണ്ട' : 'No, change'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnYes} onPress={handleTapYes}>
              <MaterialCommunityIcons name="check" size={20} color={colors.ink} />
              <Text style={styles.btnYesText}>{lang === 'ml' ? 'ആവട്ടെ, ബുക്ക് ചെയ്യൂ' : 'Yes, Book Ride'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
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
    backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { flex: 1, ...typography.h4, color: colors.text, textAlign: 'center' },
  searchBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.surface, paddingHorizontal: spacing.sm,
    paddingVertical: 8, borderRadius: borderRadius.full,
    borderWidth: 1, borderColor: colors.borderLight,
  },
  searchBtnText: { ...typography.caption, color: colors.primary, fontWeight: '700' },

  orbArea: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: spacing.xl, gap: spacing.lg,
  },
  orbRing: {
    width: 180, height: 180, borderRadius: 90,
    borderWidth: 2, alignItems: 'center', justifyContent: 'center',
  },
  orb: {
    width: 140, height: 140, borderRadius: 70,
    borderWidth: 2, alignItems: 'center', justifyContent: 'center',
  },
  statusText: {
    ...typography.h4, color: colors.text, textAlign: 'center',
    lineHeight: 28, paddingHorizontal: spacing.lg,
  },
  hintText: { ...typography.small, color: colors.textSecondary, textAlign: 'center' },

  placeCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.base,
    backgroundColor: colors.white, marginHorizontal: spacing.lg,
    borderRadius: borderRadius.xl, padding: spacing.base,
    borderWidth: 1.5, borderColor: colors.primary,
    elevation: 4, shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 8,
    marginBottom: spacing.base,
  },
  placeIconWrap: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  placeInfo: { flex: 1 },
  placeName: { ...typography.bodyBold, color: colors.text },
  placeAddr: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },

  bottomArea: {
    paddingHorizontal: spacing.lg, paddingTop: spacing.base,
    alignItems: 'center',
  },
  micButton: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.ink,
    borderWidth: 2.5, borderColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    elevation: 6, shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 10,
  },
  micButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.ink,
  },

  confirmButtons: { flexDirection: 'row', gap: spacing.sm, width: '100%' },
  btnNo: {
    flex: 1, paddingVertical: spacing.base, borderRadius: borderRadius.xl,
    backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border,
    alignItems: 'center',
  },
  btnNoText: { ...typography.bodyBold, color: colors.textSecondary },
  btnYes: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.xs, paddingVertical: spacing.base, borderRadius: borderRadius.xl,
    backgroundColor: colors.primary,
    elevation: 4, shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 8,
  },
  btnYesText: { ...typography.bodyBold, color: colors.ink },
});
