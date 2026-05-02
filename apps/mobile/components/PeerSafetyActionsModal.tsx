import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  CHATS_CARD,
  CHATS_GREEN,
  CHATS_GREEN_BORDER,
} from '../theme/chatsAmbient';
import { supabase } from '../lib/supabase';
import { blockUser } from '../lib/blockReport';
import { unmatchPeer } from '../lib/unmatch';

const TEXT = '#1A2C24';
const GRAY = '#717182';
const DESTRUCTIVE = '#D4183D';

export type PeerSafetyStart = 'main' | 'confirmUnmatch' | 'confirmBlock';

type Props = {
  visible: boolean;
  otherUserId: string | null;
  otherName: string;
  /** Initial panel each time the sheet opens. */
  start?: PeerSafetyStart;
  onClose: () => void;
  onOpenReport: () => void;
  onAfterUnmatchOrBlock: () => void;
};

type Panel = PeerSafetyStart;

export default function PeerSafetyActionsModal({
  visible,
  otherUserId,
  otherName,
  start = 'main',
  onClose,
  onOpenReport,
  onAfterUnmatchOrBlock,
}: Props) {
  const insets = useSafeAreaInsets();
  const [panel, setPanel] = useState<Panel>('main');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setPanel(start);
      setBusy(false);
      setError(null);
    }
  }, [visible, start]);

  function handleClose() {
    if (busy) return;
    onClose();
  }

  async function runUnmatch() {
    if (!otherUserId) return;
    setBusy(true);
    setError(null);
    const { error: err } = await unmatchPeer(otherUserId);
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    onAfterUnmatchOrBlock();
    handleClose();
  }

  async function runBlock() {
    if (!otherUserId) return;
    setBusy(true);
    setError(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.id) {
      setBusy(false);
      setError('Not signed in.');
      return;
    }
    const { error: uErr } = await unmatchPeer(otherUserId);
    if (uErr && __DEV__) console.warn('unmatchPeer before block:', uErr);
    const { success, error: bErr } = await blockUser(user.id, otherUserId);
    setBusy(false);
    if (!success) {
      setError(bErr ?? 'Could not block.');
      return;
    }
    onAfterUnmatchOrBlock();
    handleClose();
  }

  function renderMain() {
    return (
      <>
        <Text style={styles.sheetTitle}>{otherName}</Text>

        <TouchableOpacity
          style={styles.actionRow}
          onPress={() => setPanel('confirmUnmatch')}
          activeOpacity={0.75}
        >
          <Ionicons name="heart-dislike-outline" size={22} color={DESTRUCTIVE} />
          <Text style={[styles.actionLabel, styles.actionLabelDestructive]}>Unmatch</Text>
          <Ionicons name="chevron-forward" size={18} color={GRAY} style={styles.actionChevron} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionRow}
          onPress={() => {
            onOpenReport();
            handleClose();
          }}
          activeOpacity={0.75}
        >
          <Ionicons name="flag-outline" size={22} color={CHATS_GREEN} />
          <Text style={styles.actionLabel}>Report</Text>
          <Ionicons name="chevron-forward" size={18} color={GRAY} style={styles.actionChevron} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionRow}
          onPress={() => setPanel('confirmBlock')}
          activeOpacity={0.75}
        >
          <Ionicons name="ban-outline" size={22} color={DESTRUCTIVE} />
          <Text style={[styles.actionLabel, styles.actionLabelDestructive]}>Block</Text>
          <Ionicons name="chevron-forward" size={18} color={GRAY} style={styles.actionChevron} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.dismissRow} onPress={handleClose} activeOpacity={0.75}>
          <Text style={styles.dismissText}>Cancel</Text>
        </TouchableOpacity>
      </>
    );
  }

  function renderConfirmUnmatch() {
    return (
      <>
        <Text style={styles.sheetTitle}>Unmatch?</Text>
        <Text style={styles.confirmBody}>
          You will not stay matched in Chats. You may see each other in Discover again after about 30 days unless
          someone is blocked.
        </Text>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <View style={styles.confirmRow}>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => {
              setError(null);
              setPanel('main');
            }}
            disabled={busy}
          >
            <Text style={styles.secondaryBtnText}>Back</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.primaryBtn, styles.primaryBtnDangerFill]}
            onPress={runUnmatch}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryBtnText}>Unmatch</Text>
            )}
          </TouchableOpacity>
        </View>
      </>
    );
  }

  function renderConfirmBlock() {
    return (
      <>
        <Text style={styles.sheetTitle}>Block {otherName}?</Text>
        <Text style={styles.confirmBody}>
          They will not appear in your discover or matches, and you will not appear in theirs until you unblock them
          from your profile.
        </Text>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <View style={styles.confirmRow}>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => {
              setError(null);
              setPanel('main');
            }}
            disabled={busy}
          >
            <Text style={styles.secondaryBtnText}>Back</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.primaryBtn, styles.primaryBtnDangerFill]}
            onPress={runBlock}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryBtnText}>Block</Text>
            )}
          </TouchableOpacity>
        </View>
      </>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]} onPress={(e) => e.stopPropagation()}>
          {panel === 'main' && renderMain()}
          {panel === 'confirmUnmatch' && renderConfirmUnmatch()}
          {panel === 'confirmBlock' && renderConfirmBlock()}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(26, 44, 36, 0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: CHATS_CARD,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: CHATS_GREEN_BORDER,
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  sheetTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: TEXT,
    marginBottom: 6,
  },
  sheetSubtitle: {
    fontSize: 14,
    color: GRAY,
    marginBottom: 16,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(45, 106, 79, 0.15)',
    gap: 12,
  },
  actionLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: TEXT,
  },
  actionLabelDestructive: {
    color: DESTRUCTIVE,
  },
  actionChevron: { opacity: 0.5 },
  dismissRow: {
    marginTop: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  dismissText: {
    fontSize: 16,
    fontWeight: '600',
    color: CHATS_GREEN,
  },
  confirmBody: {
    fontSize: 15,
    lineHeight: 22,
    color: GRAY,
    marginBottom: 18,
  },
  errorText: {
    fontSize: 14,
    color: DESTRUCTIVE,
    marginBottom: 12,
    fontWeight: '600',
  },
  confirmRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  secondaryBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: CHATS_GREEN_BORDER,
    alignItems: 'center',
    backgroundColor: '#FAFBFA',
  },
  secondaryBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: CHATS_GREEN,
  },
  primaryBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  primaryBtnDangerFill: {
    backgroundColor: DESTRUCTIVE,
    borderWidth: 0,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
