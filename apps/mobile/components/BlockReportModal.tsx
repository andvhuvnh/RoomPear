import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { blockUser, reportUser } from '../lib/blockReport';
import { unmatchPeer } from '../lib/unmatch';

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
  const [panel, setPanel] = useState<'report' | 'block_confirm' | 'report_success'>('report');
  const [inlineError, setInlineError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setPanel('report');
    setInlineError(null);
    setBusy(false);
    setSelectedReason(null);
    setDetails('');
  }, [visible]);

  function reset() {
    setSelectedReason(null);
    setDetails('');
    setBusy(false);
    setPanel('report');
    setInlineError(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleReport() {
    if (!selectedReason) return;
    setBusy(true);
    setInlineError(null);
    const { success, error } = await reportUser(reporterId, reportedId, selectedReason, details);
    setBusy(false);
    if (!success) {
      setInlineError(error ?? 'Could not submit report. Try again.');
      return;
    }
    setPanel('report_success');
  }

  async function confirmBlock() {
    setBusy(true);
    setInlineError(null);
    const { error: uErr } = await unmatchPeer(reportedId);
    if (uErr && __DEV__) console.warn('unmatchPeer before block:', uErr);
    const { success, error: bErr } = await blockUser(reporterId, reportedId);
    setBusy(false);
    if (!success) {
      setInlineError(bErr ?? 'Could not block. Try again.');
      return;
    }
    reset();
    onClose();
    onBlocked();
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
          <TouchableOpacity
            onPress={() => {
              if (panel === 'block_confirm') {
                setPanel('report');
                setInlineError(null);
                return;
              }
              handleClose();
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.cancel}>{panel === 'block_confirm' ? 'Back' : 'Cancel'}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>
            {panel === 'block_confirm'
              ? `Block ${reportedName}`
              : panel === 'report_success'
                ? 'Thanks'
                : `Report ${reportedName}`}
          </Text>
          <View style={{ width: 56 }} />
        </View>

        {panel === 'block_confirm' ? (
          <View style={styles.body}>
            <Text style={styles.confirmBlockBody}>
              They will not appear in your discover and you will not appear in theirs until you unblock them from your
              profile.
            </Text>
            {inlineError ? <Text style={styles.inlineError}>{inlineError}</Text> : null}
            <TouchableOpacity
              style={[styles.submitBtn, styles.blockConfirmBtn, busy && styles.submitBtnDisabled]}
              onPress={confirmBlock}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitBtnText}>Block {reportedName}</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : panel === 'report_success' ? (
          <View style={styles.body}>
            <Text style={styles.successTitle}>Report submitted</Text>
            <Text style={styles.successBody}>Thanks for keeping RoomPear safe. We will review this shortly.</Text>
            <TouchableOpacity style={styles.submitBtn} onPress={handleClose}>
              <Text style={styles.submitBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            {inlineError ? <Text style={styles.inlineError}>{inlineError}</Text> : null}
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

            <TouchableOpacity
              style={styles.blockBtn}
              onPress={() => {
                setInlineError(null);
                setPanel('block_confirm');
              }}
              disabled={busy}
            >
              <Text style={styles.blockBtnText}>Block {reportedName}</Text>
            </TouchableOpacity>
            <Text style={styles.blockHelp}>
              Blocking removes them from your discover deck and hides you from theirs.
            </Text>
          </ScrollView>
        )}
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
  inlineError: {
    fontSize: 14,
    fontWeight: '600',
    color: '#D4183D',
    marginBottom: 12,
  },
  confirmBlockBody: {
    fontSize: 15,
    lineHeight: 22,
    color: '#717182',
    marginBottom: 20,
  },
  blockConfirmBtn: {
    backgroundColor: '#D4183D',
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A2C24',
    marginBottom: 10,
  },
  successBody: {
    fontSize: 15,
    lineHeight: 22,
    color: '#717182',
    marginBottom: 24,
  },
});
