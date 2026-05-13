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
import { Ionicons } from '@expo/vector-icons';
import { blockUser, reportUser } from '../lib/blockReport';
import { unmatchPeer } from '../lib/unmatch';
import { fonts } from '../lib/typography';

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
    if (!success) { setInlineError(error ?? 'Could not submit report. Try again.'); return; }
    setPanel('report_success');
  }

  async function confirmBlock() {
    setBusy(true);
    setInlineError(null);
    const { error: uErr } = await unmatchPeer(reportedId);
    if (uErr && __DEV__) console.warn('unmatchPeer before block:', uErr);
    const { success, error: bErr } = await blockUser(reporterId, reportedId);
    setBusy(false);
    if (!success) { setInlineError(bErr ?? 'Could not block. Try again.'); return; }
    reset();
    onClose();
    onBlocked();
  }

  const headerTitle =
    panel === 'block_confirm' ? `Block ${reportedName}` :
    panel === 'report_success' ? 'Report submitted' :
    `Report ${reportedName}`;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={[s.root, { paddingBottom: insets.bottom + 24 }]}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity
            onPress={() => {
              if (panel === 'block_confirm') { setPanel('report'); setInlineError(null); return; }
              handleClose();
            }}
            hitSlop={12}
            activeOpacity={0.6}
          >
            <Ionicons
              name={panel === 'block_confirm' ? 'chevron-back' : 'close'}
              size={22}
              color="#111111"
            />
          </TouchableOpacity>
          <Text style={s.headerTitle}>{headerTitle}</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={s.headerDivider} />

        {panel === 'block_confirm' ? (
          <View style={s.body}>
            <Text style={s.bodyText}>
              They won't appear in your discover deck and you won't appear in theirs until you unblock them from your profile.
            </Text>
            {inlineError ? <Text style={s.errorText}>{inlineError}</Text> : null}
            <TouchableOpacity
              style={[s.submitBtn, s.submitBtnDestructive, busy && s.btnDisabled]}
              onPress={confirmBlock}
              disabled={busy}
              activeOpacity={0.85}
            >
              {busy
                ? <ActivityIndicator color="#FFFFFF" />
                : <Text style={s.submitBtnText}>Block {reportedName}</Text>}
            </TouchableOpacity>
          </View>

        ) : panel === 'report_success' ? (
          <View style={[s.body, s.successBody]}>
            <Text style={s.successTitle}>Thank you</Text>
            <Text style={s.bodyText}>We'll review this and take action if it violates our community guidelines.</Text>
            <View style={s.successDivider} />
            <TouchableOpacity style={s.submitBtn} onPress={handleClose} activeOpacity={0.85}>
              <Text style={s.submitBtnText}>Done</Text>
            </TouchableOpacity>
          </View>

        ) : (
          <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
            {inlineError ? <Text style={s.errorText}>{inlineError}</Text> : null}

            <Text style={s.sectionLabel}>Why are you reporting this profile?</Text>
            <View style={s.group}>
              {REASONS.map((reason, i) => (
                <View key={reason}>
                  <TouchableOpacity
                    style={s.reasonRow}
                    onPress={() => setSelectedReason(reason)}
                    activeOpacity={0.6}
                  >
                    <Text style={[s.reasonText, selectedReason === reason && s.reasonTextSelected]}>
                      {reason}
                    </Text>
                    <View style={[s.radio, selectedReason === reason && s.radioSelected]}>
                      {selectedReason === reason && <View style={s.radioDot} />}
                    </View>
                  </TouchableOpacity>
                  {i < REASONS.length - 1 && <View style={s.rowDivider} />}
                </View>
              ))}
            </View>

            <Text style={[s.sectionLabel, { marginTop: 28 }]}>Additional details (optional)</Text>
            <View style={s.group}>
              <TextInput
                style={s.detailsInput}
                placeholder="Describe what happened…"
                placeholderTextColor="#AAAAAA"
                multiline
                numberOfLines={4}
                value={details}
                onChangeText={setDetails}
                maxLength={500}
              />
            </View>

            <TouchableOpacity
              style={[s.submitBtn, !selectedReason && s.btnDisabled, { marginTop: 28 }]}
              onPress={handleReport}
              disabled={!selectedReason || busy}
              activeOpacity={0.85}
            >
              {busy
                ? <ActivityIndicator color="#FFFFFF" />
                : <Text style={s.submitBtnText}>Submit report</Text>}
            </TouchableOpacity>

            <View style={s.orRow}>
              <View style={s.orLine} />
              <Text style={s.orLabel}>or</Text>
              <View style={s.orLine} />
            </View>

            <View style={s.group}>
              <TouchableOpacity
                style={s.blockRow}
                onPress={() => { setInlineError(null); setPanel('block_confirm'); }}
                disabled={busy}
                activeOpacity={0.6}
              >
                <Text style={s.blockBtnText}>Block {reportedName}</Text>
                <Ionicons name="chevron-forward" size={16} color="#D4183D" style={{ opacity: 0.6 }} />
              </TouchableOpacity>
            </View>
            <Text style={s.blockHelp}>
              Blocking removes them from your discover deck and hides you from theirs.
            </Text>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
  },
  headerDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  headerTitle: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: '#111111',
  },

  body: {
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 8,
  },
  successBody: {
    flex: 1,
    justifyContent: 'center',
  },

  sectionLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: '#888888',
    letterSpacing: 0.3,
    marginBottom: 8,
    paddingHorizontal: 4,
  },

  group: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.10)',
  },

  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(0,0,0,0.08)',
    marginLeft: 16,
  },

  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  reasonText: {
    fontFamily: fonts.regular,
    fontSize: 16,
    color: '#111111',
    flex: 1,
  },
  reasonTextSelected: {
    fontFamily: fonts.semiBold,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#CCCCCC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { borderColor: '#111111' },
  radioDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: '#111111',
  },

  detailsInput: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: '#111111',
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 110,
    textAlignVertical: 'top',
  },

  submitBtn: {
    backgroundColor: '#111111',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  submitBtnDestructive: {
    backgroundColor: '#D4183D',
  },
  btnDisabled: { opacity: 0.3 },
  submitBtnText: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: '#FFFFFF',
  },

  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 16,
  },
  orLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  orLabel: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: '#AAAAAA',
  },

  blockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  blockBtnText: {
    fontFamily: fonts.semiBold,
    fontSize: 16,
    color: '#D4183D',
  },
  blockHelp: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: '#AAAAAA',
    textAlign: 'center',
    marginTop: 10,
    paddingHorizontal: 4,
  },

  errorText: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: '#D4183D',
    marginBottom: 12,
  },

  bodyText: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: '#5A5A6A',
    lineHeight: 22,
    marginBottom: 24,
  },

  successDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(0,0,0,0.10)',
    marginVertical: 24,
  },
  successTitle: {
    fontFamily: fonts.extraBold,
    fontSize: 26,
    color: '#111111',
    letterSpacing: -0.5,
    marginBottom: 12,
  },
});
