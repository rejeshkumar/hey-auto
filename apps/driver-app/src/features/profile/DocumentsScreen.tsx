import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, Linking, Image,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { ScreenWrapper, Button } from '../../components';
import { colors, typography, spacing, borderRadius } from '../../theme';
import { driverApi } from '../../services/driver';

const DOC_TYPES = [
  { key: 'DRIVING_LICENSE', label: 'Driving License', icon: 'card-account-details', required: true },
  { key: 'VEHICLE_RC',   label: 'Vehicle RC',        icon: 'car-info',              required: true },
  { key: 'INSURANCE',    label: 'Insurance',         icon: 'shield-check',          required: true },
  { key: 'PERMIT',       label: 'Permit',            icon: 'file-certificate',      required: true },
  { key: 'AADHAAR',      label: 'Aadhaar Card',      icon: 'card-account-details-outline', required: true },
  { key: 'PHOTO',        label: 'Your Photo',        icon: 'account-box',           required: true },
  { key: 'VEHICLE_PHOTO',label: 'Vehicle Photo',     icon: 'car',                   required: true },
];

interface DocStatus {
  docType: string;
  status: 'PENDING' | 'VERIFIED' | 'REJECTED';
  rejectionReason?: string;
  docUrl?: string;
  docNumber?: string;
  expiryDate?: string;
}

export function DocumentsScreen({ navigation }: any) {
  const { t } = useTranslation();
  const [docs, setDocs] = useState<DocStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);

  useEffect(() => { loadDocs(); }, []);

  const loadDocs = async () => {
    setLoading(true);
    try {
      const { data } = await driverApi.getDocuments();
      setDocs(data.data || []);
    } catch {
      setDocs([]);
    } finally {
      setLoading(false);
    }
  };

  const docMap: Record<string, DocStatus> = {};
  docs.forEach(d => { docMap[d.docType] = d; });

  const verifiedCount = DOC_TYPES.filter(d => docMap[d.key]?.status === 'VERIFIED').length;
  const allVerified = verifiedCount === DOC_TYPES.length;

  const handleUpload = (docType: string, docLabel: string) => {
    Alert.alert(
      `Upload ${docLabel}`,
      'Choose how to add this document',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: '📷 Take Photo', onPress: () => pickImage(docType, 'camera') },
        { text: '🖼 Choose from Gallery', onPress: () => pickImage(docType, 'library') },
      ]
    );
  };

  const pickImage = async (docType: string, source: 'camera' | 'library') => {
    let result;
    if (source === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Camera access is needed to take a photo.');
        return;
      }
      result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
        allowsEditing: true,
      });
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Photo library access is needed.');
        return;
      }
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
        allowsEditing: true,
      });
    }

    if (result.canceled || !result.assets?.[0]) return;
    await submitDoc(docType, result.assets[0].uri);
  };

  const submitDoc = async (docType: string, localUri: string) => {
    setUploading(docType);
    try {
      const ext = localUri.split('.').pop()?.split('?')[0] || 'jpg';
      const formData = new FormData();
      formData.append('file', { uri: localUri, name: `doc.${ext}`, type: `image/${ext}` } as any);
      formData.append('docType', docType);
      await driverApi.uploadDocumentFile(formData);
      await loadDocs();
      Alert.alert('Submitted', 'Document submitted for review. Admin will verify shortly.');
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error?.message || 'Upload failed');
    } finally {
      setUploading(null);
    }
  };

  const statusColor = (status?: string) => {
    if (status === 'VERIFIED') return colors.success;
    if (status === 'REJECTED') return colors.error;
    if (status === 'PENDING') return colors.warning;
    return colors.textLight;
  };

  const statusLabel = (status?: string) => {
    if (status === 'VERIFIED') return 'Verified';
    if (status === 'REJECTED') return 'Rejected';
    if (status === 'PENDING') return 'Under Review';
    return 'Not Uploaded';
  };

  const statusIcon = (status?: string) => {
    if (status === 'VERIFIED') return 'check-circle';
    if (status === 'REJECTED') return 'close-circle';
    if (status === 'PENDING') return 'clock-outline';
    return 'upload-outline';
  };

  return (
    <ScreenWrapper>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>My Documents</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xxxl }} />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

          {/* Progress bar */}
          <View style={styles.progressCard}>
            <View style={styles.progressTop}>
              <Text style={styles.progressLabel}>Verification Progress</Text>
              <Text style={[styles.progressCount, { color: allVerified ? colors.success : colors.warning }]}>
                {verifiedCount}/{DOC_TYPES.length}
              </Text>
            </View>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${(verifiedCount / DOC_TYPES.length) * 100}%` as any, backgroundColor: allVerified ? colors.success : colors.primary }]} />
            </View>
            <Text style={styles.progressSub}>
              {allVerified
                ? '✓ All documents verified — you can go online!'
                : `${DOC_TYPES.length - verifiedCount} document(s) remaining`}
            </Text>
          </View>

          {DOC_TYPES.map(docType => {
            const existing = docMap[docType.key];
            const isUploading = uploading === docType.key;

            return (
              <View key={docType.key} style={styles.docCard}>
                <View style={[styles.docIcon, { backgroundColor: statusColor(existing?.status) + '20' }]}>
                  <Icon name={docType.icon as any} size={24} color={statusColor(existing?.status)} />
                </View>
                <View style={styles.docInfo}>
                  <View style={styles.docRow}>
                    <Text style={styles.docLabel}>{docType.label}</Text>
                    {docType.required && !existing && (
                      <Text style={styles.requiredBadge}>Required</Text>
                    )}
                  </View>
                  <View style={styles.statusRow}>
                    <Icon name={statusIcon(existing?.status) as any} size={14} color={statusColor(existing?.status)} />
                    <Text style={[styles.statusText, { color: statusColor(existing?.status) }]}>
                      {statusLabel(existing?.status)}
                    </Text>
                  </View>
                  {existing?.rejectionReason && (
                    <Text style={styles.rejectReason}>⚠ {existing.rejectionReason}</Text>
                  )}
                  {existing?.docUrl && (
                    <TouchableOpacity onPress={() => Linking.openURL(existing.docUrl!)} style={styles.thumbWrap}>
                      <Image source={{ uri: existing.docUrl }} style={styles.thumb} resizeMode="cover" />
                      <Text style={styles.viewLink}>View doc →</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <TouchableOpacity
                  style={[
                    styles.uploadBtn,
                    existing?.status === 'VERIFIED' && styles.uploadBtnDisabled,
                  ]}
                  onPress={() => existing?.status !== 'VERIFIED' && handleUpload(docType.key, docType.label)}
                  disabled={existing?.status === 'VERIFIED' || isUploading}
                >
                  {isUploading
                    ? <ActivityIndicator size="small" color={colors.white} />
                    : <Icon
                        name={existing?.status === 'VERIFIED' ? 'check' : existing ? 'refresh' : 'upload'}
                        size={18}
                        color={existing?.status === 'VERIFIED' ? colors.success : colors.primary}
                      />
                  }
                </TouchableOpacity>
              </View>
            );
          })}

          <View style={styles.noteCard}>
            <Icon name="information" size={18} color={colors.info} />
            <Text style={styles.noteText}>
              Documents are reviewed by Aye Auto admin within 24 hours. You'll receive a notification once verified.
            </Text>
          </View>
        </ScrollView>
      )}
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.base, paddingHorizontal: spacing.base },
  backBtn: { width: 40, height: 40, borderRadius: borderRadius.full, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.h4, color: colors.text },
  content: { padding: spacing.base, paddingBottom: spacing.xxxl },
  progressCard: { backgroundColor: colors.card, borderRadius: borderRadius.xl, padding: spacing.lg, marginBottom: spacing.base, elevation: 1, shadowColor: colors.black, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3 },
  progressTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  progressLabel: { ...typography.smallBold, color: colors.text },
  progressCount: { ...typography.h4 },
  progressBar: { height: 8, backgroundColor: colors.borderLight, borderRadius: borderRadius.full, overflow: 'hidden', marginBottom: spacing.sm },
  progressFill: { height: 8, borderRadius: borderRadius.full },
  progressSub: { ...typography.caption, color: colors.textSecondary },
  docCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.base, backgroundColor: colors.card, borderRadius: borderRadius.xl, padding: spacing.base, marginBottom: spacing.sm, elevation: 1, shadowColor: colors.black, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 },
  docIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  docInfo: { flex: 1 },
  docRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  docLabel: { ...typography.smallBold, color: colors.text },
  requiredBadge: { fontSize: 10, fontWeight: '700', color: colors.error, backgroundColor: colors.errorLight, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  statusText: { ...typography.caption, fontWeight: '600' },
  rejectReason: { ...typography.caption, color: colors.error, marginTop: 3 },
  thumbWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: 4 },
  thumb: { width: 36, height: 36, borderRadius: 6, backgroundColor: colors.borderLight },
  viewLink: { ...typography.caption, color: colors.primary },
  uploadBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  uploadBtnDisabled: { backgroundColor: colors.successLight },
  noteCard: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, backgroundColor: colors.infoLight, borderRadius: borderRadius.lg, padding: spacing.base, marginTop: spacing.sm },
  noteText: { ...typography.caption, color: colors.info, flex: 1, lineHeight: 18 },
});
