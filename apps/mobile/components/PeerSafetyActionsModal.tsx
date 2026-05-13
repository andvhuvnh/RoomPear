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
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { blockUser } from '../lib/blockReport';
import { unmatchPeer } from '../lib/unmatch';
import { fonts } from '../lib/typography';

const DESTRUCTIVE = '#D4183D';

export type PeerSafetyStart = 'main' | 'confirmUnmatch' | 'confirmBlock';

type Props = {
  visible: boolean;
  otherUserId: string | null;
  otherName: string;
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
    if (err) { setError(err); return; }
    onAfterUnmatchOrBlock();
    handleClose();
  }

  async function runBlock() {
    if (!otherUserId) return;
    setBusy(true);
    setError(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) { setBusy(false); setError('Not signed in.'); return; }
    const { error: uErr } = await unmatchPeer(otherUserId);
    if (uErr && __DEV__) console.warn('unmatchPeer before block:', uErr);
    const { success, error: bErr } = await blockUser(user.id, otherUserId);
    setBusy(false);
    if (!success) { setError(bErr ?? 'Could not block.'); return; }
    onAfterUnmatchOrBlock();
    handleClose();
  }

  function renderMain() {
    return (
      <>
        <Text style={s.title}>{otherName}</Text>

        <View style={s.actionsCard}>
          <TouchableOpacity style={s.actionRow} onPress={() => setPanel('confirmUnmatch')} activeOpacity={0.75}>
            <View style={[s.actionIconWrap, s.actionIconDestructive]}>
              <Ionicons name="heart-dislike-outline" size={18} color={DESTRUCTIVE} />
            </View>
            <Text style={[s.actionLabel, s.actionLabelDestructive]}>Unmatch</Text>
            <Ionicons name="chevron-forward" size={16} color="rgba(0,0,0,0.25)" />
          </TouchableOpacity>

          <View style={s.actionDivider} />

          <TouchableOpacity
            style={s.actionRow}
            onPress={() => { onOpenReport(); handleClose(); }}
            activeOpacity={0.75}
          >
            <View style={s.actionIconWrap}>
              <Ionicons name="flag-outline" size={18} color="#2D6A4F" />
            </View>
            <Text style={s.actionLabel}>Report</Text>
            <Ionicons name="chevron-forward" size={16} color="rgba(0,0,0,0.25)" />
          </TouchableOpacity>

          <View style={s.actionDivider} />

          <TouchableOpacity style={s.actionRow} onPress={() => setPanel('confirmBlock')} activeOpacity={0.75}>
            <View style={[s.actionIconWrap, s.actionIconDestructive]}>
              <Ionicons name="ban-outline" size={18} color={DESTRUCTIVE} />
            </View>
            <Text style={[s.actionLabel, s.actionLabelDestructive]}>Block</Text>
            <Ionicons name="chevron-forward" size={16} color="rgba(0,0,0,0.25)" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={s.cancelBtn} onPress={handleClose} activeOpacity={0.75}>
          <Text style={s.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
      </>
    );
  }

  function renderConfirmUnmatch() {
    return (
      <>
        <Text style={s.title}>Unmatch?</Text>
        <Text style={s.body}>
          You won't stay matched in Chats. You may see each other in Discover again after about 30 days.
        </Text>
        {error ? <Text style={s.errorText}>{error}</Text> : null}
        <View style={s.btnRow}>
          <TouchableOpacity style={s.secondaryBtn} onPress={() => { setError(null); setPanel('main'); }} disabled={busy} activeOpacity={0.8}>
            <Text style={s.secondaryBtnText}>Back</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.destructiveBtn} onPress={runUnmatch} disabled={busy} activeOpacity={0.85}>
            {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={s.destructiveBtnText}>Unmatch</Text>}
          </TouchableOpacity>
        </View>
      </>
    );
  }

  function renderConfirmBlock() {
    return (
      <>
        <Text style={s.title}>Block {otherName}?</Text>
        <Text style={s.body}>
          They won't appear in your discover or matches, and you won't appear in theirs until you unblock them.
        </Text>
        {error ? <Text style={s.errorText}>{error}</Text> : null}
        <View style={s.btnRow}>
          <TouchableOpacity style={s.secondaryBtn} onPress={() => { setError(null); setPanel('main'); }} disabled={busy} activeOpacity={0.8}>
            <Text style={s.secondaryBtnText}>Back</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.destructiveBtn} onPress={runBlock} disabled={busy} activeOpacity={0.85}>
            {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={s.destructiveBtnText}>Block</Text>}
          </TouchableOpacity>
        </View>
      </>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <Pressable style={s.backdrop} onPress={handleClose}>
        <Pressable onPress={(e) => e.stopPropagation()}>
          <LinearGradient
            colors={['#EDF5EA', '#F4F9F0', '#FAFDF7', '#FFFFFF']}
            locations={[0, 0.3, 0.65, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={[s.sheet, { paddingBottom: insets.bottom + 20 }]}
          >
            <View style={s.handle} />
            {panel === 'main' && renderMain()}
            {panel === 'confirmUnmatch' && renderConfirmUnmatch()}
            {panel === 'confirmBlock' && renderConfirmBlock()}
          </LinearGradient>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(45,106,79,0.18)',
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  handle: {
    width: 40, height: 5, borderRadius: 3,
    backgroundColor: 'rgba(45,106,79,0.25)',
    alignSelf: 'center', marginBottom: 18,
  },
  title: {
    fontFamily: fonts.extraBold,
    fontSize: 20, color: '#111111',
    letterSpacing: -0.3, marginBottom: 16,
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: 15, color: '#7A9080',
    lineHeight: 22, marginBottom: 20,
  },
  errorText: {
    fontFamily: fonts.semiBold,
    fontSize: 13, color: DESTRUCTIVE,
    marginBottom: 12,
  },

  actionsCard: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 18,
    borderWidth: 1, borderColor: 'rgba(45,106,79,0.13)',
    shadowColor: '#2D6A4F', shadowOpacity: 0.09,
    shadowOffset: { width: 0, height: 3 }, shadowRadius: 10, elevation: 3,
    marginBottom: 12,
    overflow: 'hidden',
  },
  actionRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 15, gap: 12,
  },
  actionDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(45,106,79,0.10)',
    marginLeft: 52,
  },
  actionIconWrap: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: 'rgba(45,106,79,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  actionIconDestructive: {
    backgroundColor: 'rgba(212,24,61,0.08)',
  },
  actionLabel: {
    fontFamily: fonts.semiBold,
    flex: 1, fontSize: 15, color: '#111111',
  },
  actionLabelDestructive: { color: DESTRUCTIVE },

  cancelBtn: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 18, paddingVertical: 15,
    alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(45,106,79,0.13)',
    shadowColor: '#2D6A4F', shadowOpacity: 0.07,
    shadowOffset: { width: 0, height: 2 }, shadowRadius: 8, elevation: 2,
  },
  cancelBtnText: {
    fontFamily: fonts.semiBold, fontSize: 15, color: '#7A9080',
  },

  btnRow: { flexDirection: 'row', gap: 12 },
  secondaryBtn: {
    flex: 1, paddingVertical: 15, borderRadius: 16,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1, borderColor: 'rgba(45,106,79,0.13)',
  },
  secondaryBtnText: {
    fontFamily: fonts.semiBold, fontSize: 15, color: '#111111',
  },
  destructiveBtn: {
    flex: 1, paddingVertical: 15, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: DESTRUCTIVE,
    minHeight: 50,
  },
  destructiveBtnText: {
    fontFamily: fonts.bold, fontSize: 15, color: '#FFFFFF',
  },
});
