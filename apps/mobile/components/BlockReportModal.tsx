import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { blockUser, reportUser } from '../lib/blockReport';

const REASONS = [
  'Fake profile',
  'Inappropriate photos',
  'Harassment',
  'Spam or scam',
  'Underage user',
  'Other',
];

type Props = {
  visible: boolean;
  reporterId: string;
  reportedId: string;
  reportedName: string;
  onClose: () => void;
  onBlocked: () => void;
};

export default function BlockReportModal({
  visible,
  reporterId,
  reportedId,
  reportedName,
  onClose,
  onBlocked,
}: Props) {
  const insets = useSafeAreaInsets();
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);

  function reset() {
    setSelectedReason(null);
    setDetails('');
    setBusy(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleReport() {
    if (!selectedReason) return;
    setBusy(true);
    const { success, error } = await reportUser(reporterId, reportedId, selectedReason, details);
    setBusy(false);
    if (!success) {
      Alert.alert('Error', error ?? 'Could not submit report. Try again.');
      return;
    }
    reset();
    onClose();
    Alert.alert('Report submitted', 'Thanks for keeping RoomPear safe. We\'ll review this shortly.');
  }

  async function handleBlock() {
    Alert.alert(
      `Block ${reportedName}?`,
      "They won't appear in your discover and you won't appear in theirs.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            await blockUser(reporterId, reportedId);
            setBusy(false);
            reset();
            onClose();
            onBlocked();
          },
        },
      ]
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={[styles.root, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.cancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Report {reportedName}</Text>
          <View style={{ width: 56 }} />
        </View>

        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionLabel}>Why are you reporting this profile?</Text>
          <View style={styles.reasonsGroup}>
            {REASONS.map((reason, i) => (
              <TouchableOpacity
                key={reason}
                style={[
                  styles.reasonRow,
                  i < REASONS.length - 1 && styles.reasonDivider,
                  selectedReason === reason && styles.reasonRowSelected,
                ]}
                onPress={() => setSelectedReason(reason)}
              >
                <Text style={[styles.reasonText, selectedReason === reason && styles.reasonTextSelected]}>
                  {reason}
                </Text>
                <View style={[styles.radio, selectedReason === reason && styles.radioSelected]}>
                  {selectedReason === reason && <View style={styles.radioDot} />}
                </View>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.sectionLabel}>Additional details (optional)</Text>
          <TextInput
            style={styles.detailsInput}
            placeholder="Describe what happened…"
            placeholderTextColor="#A0A8A4"
            multiline
            numberOfLines={4}
            value={details}
            onChangeText={setDetails}
            maxLength={500}
          />

          <TouchableOpacity
            style={[styles.submitBtn, !selectedReason && styles.submitBtnDisabled]}
            onPress={handleReport}
            disabled={!selectedReason || busy}
          >
            {busy ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitBtnText}>Submit report</Text>
            )}
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerLabel}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity style={styles.blockBtn} onPress={handleBlock} disabled={busy}>
            <Text style={styles.blockBtnText}>Block {reportedName}</Text>
          </TouchableOpacity>
          <Text style={styles.blockHelp}>
            Blocking removes them from your discover deck and hides you from theirs.
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  cancel: { fontSize: 16, color: '#2D6A4F', fontWeight: '500' },
  title: { fontSize: 17, fontWeight: '700', color: '#1A2C24' },
  body: { padding: 16, gap: 12 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#717182',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 8,
  },
  reasonsGroup: {
    backgroundColor: '#F3F3F5',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#F3F3F5',
  },
  reasonRowSelected: { backgroundColor: '#EBF5EF' },
  reasonDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.08)',
  },
  reasonText: { fontSize: 15, color: '#252525', flex: 1 },
  reasonTextSelected: { color: '#2D6A4F', fontWeight: '600' },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#C0C0CC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { borderColor: '#2D6A4F' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#2D6A4F' },
  detailsInput: {
    backgroundColor: '#F3F3F5',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.08)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#252525',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  submitBtn: {
    backgroundColor: '#1A2C24',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  submitBtnDisabled: { opacity: 0.4 },
  submitBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 4,
  },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(0,0,0,0.1)' },
  dividerLabel: { fontSize: 13, color: '#717182' },
  blockBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#D4183D',
  },
  blockBtnText: { color: '#D4183D', fontSize: 16, fontWeight: '700' },
  blockHelp: {
    fontSize: 12,
    color: '#A0A8A4',
    textAlign: 'center',
    marginTop: 4,
  },
});
