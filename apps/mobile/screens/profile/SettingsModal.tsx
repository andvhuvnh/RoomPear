import { ActivityIndicator, Animated, Dimensions, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { fonts } from '../../lib/typography';

const SCREEN_WIDTH = Dimensions.get('window').width;

type Props = {
  visible: boolean;
  profile: Record<string, any> | null;
  user: { id: string; email?: string } | null;
  referralDraft: string;
  referralBusy: boolean;
  setReferralDraft: (v: string) => void;
  onClose: () => void;
  onCopyReferralCode: (code: string) => void;
  onApplyReferralCode: () => void;
  isPaused: boolean;
  onTogglePause: (value: boolean) => void;
  isPremium: boolean;
  onUpgradeToPlus: () => void;
  onManageSubscription: () => void;
  onDeleteAccount: () => void;
  onOpenBlockedUsers: () => void;
  onSignOut: () => void;
  onDevShowOnboarding?: () => void;
  onDevTogglePremium?: (isPremium: boolean) => void;
  devPremiumBusy?: boolean;
  styles: Record<string, unknown>;
  theme: { foreground: string; mutedForeground: string; destructive: string; primaryForeground: string };
};

export default function SettingsModal({
  visible,
  profile,
  user,
  referralDraft,
  referralBusy,
  setReferralDraft,
  onClose,
  isPaused,
  onTogglePause,
  onCopyReferralCode,
  onApplyReferralCode,
  isPremium,
  onUpgradeToPlus,
  onManageSubscription,
  onDeleteAccount,
  onOpenBlockedUsers,
  onSignOut,
  onDevShowOnboarding,
  onDevTogglePremium,
  devPremiumBusy = false,
}: Props) {
  const insets = useSafeAreaInsets();
  const screenSlide = useRef(new Animated.Value(SCREEN_WIDTH)).current;

  const startSlideIn = () => {
    screenSlide.setValue(SCREEN_WIDTH);
    Animated.spring(screenSlide, { toValue: 0, useNativeDriver: true, damping: 28, stiffness: 140, mass: 1 }).start();
  };

  const handleClose = () => {
    Animated.timing(screenSlide, { toValue: SCREEN_WIDTH, duration: 340, useNativeDriver: true }).start(() => onClose());
  };

  // Delete account
  const [deleteStep, setDeleteStep] = useState(0);
  const deleteScale = useRef(new Animated.Value(0.7)).current;
  const deleteOpacity = useRef(new Animated.Value(0)).current;

  const showDeleteModal = () => {
    setDeleteStep(1);
    deleteScale.setValue(0.7);
    deleteOpacity.setValue(0);
    Animated.parallel([
      Animated.spring(deleteScale, { toValue: 1, useNativeDriver: true, damping: 18, stiffness: 280, mass: 0.8 }),
      Animated.timing(deleteOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();
  };

  const advanceDeleteStep = () => {
    deleteScale.setValue(0.82);
    Animated.spring(deleteScale, { toValue: 1, useNativeDriver: true, damping: 16, stiffness: 320, mass: 0.7 }).start();
    setDeleteStep((s) => s + 1);
  };

  const dismissDeleteModal = () => {
    Animated.parallel([
      Animated.timing(deleteScale, { toValue: 0.85, duration: 180, useNativeDriver: true }),
      Animated.timing(deleteOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => setDeleteStep(0));
  };

  const DELETE_STEPS = [
    null,
    { title: 'Delete your account?', body: 'Your profile, matches, and all messages will be permanently erased. This cannot be undone.', confirm: 'Yes, delete my account', cancel: 'Wait, go back' },
    { title: 'This is permanent.', body: 'Every match and conversation you have will be gone forever. There is no recovering them.', confirm: 'Delete my account forever', cancel: 'Keep my account' },
  ];

  // Pause confirm sheet
  const [pauseConfirmVisible, setPauseConfirmVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(400)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  const showPauseConfirm = () => {
    setPauseConfirmVisible(true);
    Animated.parallel([
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 26, stiffness: 180, mass: 1 }),
      Animated.timing(overlayOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
  };

  const hidePauseConfirm = (then?: () => void) => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 400, duration: 280, useNativeDriver: true }),
      Animated.timing(overlayOpacity, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start(() => { setPauseConfirmVisible(false); then?.(); });
  };

  const handleSwitchChange = (value: boolean) => {
    if (value) { showPauseConfirm(); } else { onTogglePause(false); }
  };

  return (
    <Modal
      visible={visible}
      animationType="none"
      presentationStyle="overFullScreen"
      transparent
      onShow={startSlideIn}
      onRequestClose={handleClose}
    >
      <Animated.View style={[s.root, { transform: [{ translateX: screenSlide }] }]}>
        <LinearGradient
          colors={['#EDF5EA', '#F4F9F0', '#FAFDF7', '#FFFFFF']}
          locations={[0, 0.3, 0.65, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        {/* Header */}
        <View style={[s.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={handleClose} style={s.backCircle} hitSlop={10} activeOpacity={0.75}>
            <Ionicons name="chevron-back" size={22} color="#111111" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Settings</Text>
          <View style={{ width: 38 }} />
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 40 }]}
          showsVerticalScrollIndicator={false}
        >

          {/* Account */}
          <Text style={s.sectionLabel}>ACCOUNT</Text>
          <View style={s.card}>
            {user?.email ? (
              <View style={s.infoRow}>
                <View style={s.iconBadge}>
                  <Ionicons name="mail-outline" size={16} color="#2D6A4F" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.infoLabel}>Email</Text>
                  <Text style={s.infoValue}>{user.email}</Text>
                </View>
              </View>
            ) : null}
            {user?.email && <View style={s.divider} />}
            <View style={s.infoRow}>
              <View style={s.iconBadge}>
                <Ionicons name="ribbon-outline" size={16} color="#2D6A4F" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.infoLabel}>Plan</Text>
                <Text style={s.infoValue}>{isPremium ? 'RoomPear+' : 'Free'}</Text>
              </View>
            </View>
          </View>

          {/* Premium row */}
          {isPremium ? (
            <>
              <Text style={s.sectionLabel}>SUBSCRIPTION</Text>
              <TouchableOpacity style={s.card} onPress={onManageSubscription} activeOpacity={0.85}>
                <View style={s.actionRow}>
                  <View style={s.iconBadge}>
                    <Ionicons name="card-outline" size={16} color="#2D6A4F" />
                  </View>
                  <Text style={s.actionTitle}>Manage subscription</Text>
                  <Ionicons name="chevron-forward" size={16} color="#A0B0A8" />
                </View>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={s.sectionLabel}>ROOMPEAR+</Text>
              <TouchableOpacity style={s.premiumCard} onPress={onUpgradeToPlus} activeOpacity={0.88}>
                <View style={s.premiumLeft}>
                  <View style={s.premiumEyebrowRow}>
                    <Ionicons name="star" size={11} color="#C84200" />
                    <Text style={s.premiumEyebrow}>UPGRADE</Text>
                  </View>
                  <Text style={s.premiumTitle}>Get RoomPear+</Text>
                  <Text style={s.premiumSub}>Unlimited swipes, see who liked you, and more.</Text>
                </View>
                <View style={s.premiumArrow}>
                  <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
                </View>
              </TouchableOpacity>
            </>
          )}

          {/* Invite */}
          <Text style={s.sectionLabel}>INVITE FRIENDS</Text>
          <View style={[s.card, s.cardGolden]}>
            <View style={s.inviteHelpRow}>
              <View style={s.iconBadge}>
                <Ionicons name="gift-outline" size={16} color="#2D6A4F" />
              </View>
              <Text style={s.inviteHelp}>Share your code. When a friend joins and applies it, you both get a bonus reveal.</Text>
            </View>
            {profile?.referral_code ? (
              <>
                <View style={s.divider} />
                <View style={s.referralRow}>
                  <Text style={s.referralCode}>{profile.referral_code}</Text>
                  <TouchableOpacity style={s.copyBtn} onPress={() => onCopyReferralCode(profile.referral_code as string)} activeOpacity={0.8}>
                    <Text style={s.copyBtnText}>Copy</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : null}
            {!profile?.referred_by_user_id ? (
              <>
                <View style={s.divider} />
                <Text style={s.inputLabel}>Have a friend's code?</Text>
                <TextInput
                  style={s.input}
                  placeholder="Enter code"
                  placeholderTextColor="#A0B0A8"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  value={referralDraft}
                  onChangeText={(t) => setReferralDraft(t.toUpperCase())}
                  editable={!referralBusy}
                />
                <TouchableOpacity
                  style={[s.applyBtn, referralBusy && { opacity: 0.5 }]}
                  onPress={onApplyReferralCode}
                  disabled={referralBusy}
                  activeOpacity={0.85}
                >
                  {referralBusy ? <ActivityIndicator color="#fff" /> : <Text style={s.applyBtnText}>Apply code</Text>}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={s.divider} />
                <Text style={s.inviteLinked}>You joined with a friend's referral.</Text>
              </>
            )}
          </View>

          {/* Visibility */}
          <Text style={s.sectionLabel}>VISIBILITY</Text>
          <View style={[s.card, s.cardTeal]}>
            <View style={s.actionRow}>
              <View style={s.iconBadge}>
                <Ionicons name="pause-circle-outline" size={16} color="#2D6A4F" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.actionTitle}>Pause my profile</Text>
                <Text style={s.actionSub}>{isPaused ? 'Hidden from discover' : 'Visible to others'}</Text>
              </View>
              <Switch
                value={isPaused}
                onValueChange={handleSwitchChange}
                trackColor={{ false: '#D1D5DB', true: '#4A7C59' }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>

          {/* Privacy */}
          <Text style={s.sectionLabel}>PRIVACY & SAFETY</Text>
          <View style={[s.card, s.cardSage]}>
            <TouchableOpacity style={s.actionRow} onPress={onOpenBlockedUsers} activeOpacity={0.8}>
              <View style={s.iconBadge}>
                <Ionicons name="ban-outline" size={16} color="#2D6A4F" />
              </View>
              <Text style={[s.actionTitle, { flex: 1 }]}>Blocked users</Text>
              <Ionicons name="chevron-forward" size={16} color="#A0B0A8" />
            </TouchableOpacity>
          </View>

          {/* Sign out */}
          <TouchableOpacity style={s.signOutBtn} onPress={onSignOut} activeOpacity={0.85}>
            <Ionicons name="log-out-outline" size={18} color="#111111" />
            <Text style={s.signOutText}>Sign out</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.deleteBtn} onPress={showDeleteModal} activeOpacity={0.7}>
            <Text style={s.deleteText}>Delete account</Text>
          </TouchableOpacity>

          {/* Dev tools */}
          {__DEV__ && onDevTogglePremium && (
            <>
              <Text style={s.sectionLabel}>DEV</Text>
              <View style={s.card}>
                <View style={s.actionRow}>
                  <View style={s.iconBadge}>
                    <Ionicons name="sparkles-outline" size={16} color="#2D6A4F" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.actionTitle}>Premium account</Text>
                    <Text style={s.actionSub}>Toggle to test premium features</Text>
                  </View>
                  {devPremiumBusy ? <ActivityIndicator color="#2D6A4F" /> : (
                    <Switch value={isPremium} onValueChange={onDevTogglePremium} trackColor={{ false: '#D1D5DB', true: '#4A7C59' }} thumbColor="#FFFFFF" />
                  )}
                </View>
              </View>
            </>
          )}
          {__DEV__ && onDevShowOnboarding && (
            <TouchableOpacity style={s.devBtn} onPress={onDevShowOnboarding} activeOpacity={0.8}>
              <Text style={s.devBtnText}>Preview Onboarding</Text>
            </TouchableOpacity>
          )}
        </ScrollView>

        {/* Pause confirm sheet */}
        {pauseConfirmVisible && (
          <Pressable style={pc.overlay} onPress={() => hidePauseConfirm()}>
            <Animated.View style={[pc.overlayBg, { opacity: overlayOpacity }]} pointerEvents="none" />
            <Pressable onPress={() => {}}>
              <Animated.View style={[pc.sheet, { transform: [{ translateY: slideAnim }] }]}>
                <View style={pc.handle} />
                <Text style={pc.title}>Pause your profile?</Text>
                <Text style={pc.body}>You won't appear in anyone's discover until you unpause. You can still chat with your existing matches.</Text>
                <TouchableOpacity style={pc.confirmBtn} activeOpacity={0.85} onPress={() => hidePauseConfirm(() => onTogglePause(true))}>
                  <Text style={pc.confirmBtnText}>Yes, pause it</Text>
                </TouchableOpacity>
                <TouchableOpacity style={pc.cancelBtn} activeOpacity={0.7} onPress={() => hidePauseConfirm()}>
                  <Text style={pc.cancelBtnText}>Never mind</Text>
                </TouchableOpacity>
              </Animated.View>
            </Pressable>
          </Pressable>
        )}

        {/* Delete confirm modal */}
        {deleteStep > 0 && (() => {
          const step = DELETE_STEPS[deleteStep]!;
          const isFinal = deleteStep === 2;
          return (
            <Pressable style={dm.overlay} onPress={dismissDeleteModal}>
              <Animated.View style={[dm.backdrop, { opacity: deleteOpacity }]} pointerEvents="none" />
              <Pressable onPress={() => {}}>
                <Animated.View style={[dm.card, { opacity: deleteOpacity, transform: [{ scale: deleteScale }] }]}>
                  <Text style={dm.title}>{step.title}</Text>
                  <Text style={dm.body}>{step.body}</Text>
                  <TouchableOpacity
                    style={[dm.confirmBtn, isFinal && dm.confirmBtnFinal]}
                    activeOpacity={0.85}
                    onPress={() => isFinal ? (dismissDeleteModal(), setTimeout(onDeleteAccount, 200)) : advanceDeleteStep()}
                  >
                    <Text style={[dm.confirmText, isFinal && dm.confirmTextFinal]}>{step.confirm}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={dm.cancelBtn} activeOpacity={0.7} onPress={dismissDeleteModal}>
                    <Text style={dm.cancelText}>{step.cancel}</Text>
                  </TouchableOpacity>
                </Animated.View>
              </Pressable>
            </Pressable>
          );
        })()}
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F4F9F0' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  backCircle: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.80)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.08)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 6, elevation: 2,
  },
  headerTitle: { fontFamily: fonts.extraBold, fontSize: 20, color: '#111111', letterSpacing: -0.4 },

  scrollContent: { paddingHorizontal: 20, paddingTop: 8 },

  sectionLabel: {
    fontFamily: fonts.bold, fontSize: 11,
    color: '#7A9080', letterSpacing: 0.9,
    marginBottom: 8, marginTop: 20,
  },

  card: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 18, padding: 14, marginBottom: 4,
    borderWidth: 1,
    borderColor: 'rgba(45,106,79,0.13)',
    shadowColor: '#2D6A4F', shadowOpacity: 0.11,
    shadowOffset: { width: 0, height: 3 }, shadowRadius: 10, elevation: 3,
  },
  cardGolden: {
    borderColor: 'rgba(122,106,26,0.15)',
    shadowColor: '#7A6A1A', shadowOpacity: 0.12,
  },
  cardTeal: {
    borderColor: 'rgba(26,92,72,0.13)',
    shadowColor: '#1A5C48', shadowOpacity: 0.11,
  },
  cardSage: {
    borderColor: 'rgba(74,112,96,0.12)',
    shadowColor: '#4A7060', shadowOpacity: 0.10,
  },

  iconBadge: {
    width: 32, height: 32, borderRadius: 11,
    backgroundColor: 'rgba(45,106,79,0.09)',
    alignItems: 'center', justifyContent: 'center',
    marginRight: 12,
  },

  divider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(0,0,0,0.07)', marginVertical: 10, marginLeft: 44 },

  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  infoLabel: { fontFamily: fonts.semiBold, fontSize: 12, color: '#7A9080', marginBottom: 2 },
  infoValue: { fontFamily: fonts.semiBold, fontSize: 14, color: '#111111' },

  actionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 2 },
  actionTitle: { fontFamily: fonts.semiBold, fontSize: 15, color: '#111111' },
  actionSub: { fontFamily: fonts.regular, fontSize: 12, color: '#7A9080', marginTop: 1 },

  // Premium card
  premiumCard: {
    backgroundColor: '#FBF6E8', borderRadius: 18, padding: 16, marginBottom: 4,
    borderWidth: 1, borderColor: 'rgba(200,66,0,0.22)',
    flexDirection: 'row', alignItems: 'center', gap: 12,
    shadowColor: '#C84200', shadowOpacity: 0.14,
    shadowOffset: { width: 0, height: 3 }, shadowRadius: 10, elevation: 3,
  },
  premiumLeft: { flex: 1 },
  premiumEyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
  premiumEyebrow: { fontFamily: fonts.bold, fontSize: 11, color: '#C84200', letterSpacing: 0.9 },
  premiumTitle: { fontFamily: fonts.extraBold, fontSize: 18, color: '#111111', letterSpacing: -0.4 },
  premiumSub: { fontFamily: fonts.regular, fontSize: 13, color: '#3A3020', marginTop: 3 },
  premiumArrow: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#111111',
    alignItems: 'center', justifyContent: 'center',
  },

  // Invite
  inviteHelpRow: { flexDirection: 'row', alignItems: 'flex-start' },
  inviteHelp: { flex: 1, fontFamily: fonts.regular, fontSize: 13, color: '#4A6054', lineHeight: 19 },
  referralRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  referralCode: { fontFamily: fonts.extraBold, fontSize: 22, color: '#111111', letterSpacing: 2 },
  copyBtn: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10,
    backgroundColor: '#111111',
  },
  copyBtnText: { fontFamily: fonts.bold, fontSize: 13, color: '#FFFFFF' },
  inputLabel: { fontFamily: fonts.semiBold, fontSize: 12, color: '#7A9080', marginBottom: 6 },
  input: {
    backgroundColor: 'rgba(0,0,0,0.04)', borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,0,0,0.08)',
    paddingHorizontal: 14, paddingVertical: 11,
    fontFamily: fonts.semiBold, fontSize: 15, color: '#111111',
    letterSpacing: 1, marginBottom: 10,
  },
  applyBtn: {
    backgroundColor: '#111111', borderRadius: 12,
    paddingVertical: 13, alignItems: 'center',
  },
  applyBtnText: { fontFamily: fonts.bold, fontSize: 14, color: '#FFFFFF' },
  inviteLinked: { fontFamily: fonts.regular, fontSize: 13, color: '#7A9080' },

  // Sign out / delete
  signOutBtn: {
    backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 18,
    paddingVertical: 16, marginTop: 20, marginBottom: 4,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1, borderColor: 'rgba(45,106,79,0.13)',
    shadowColor: '#2D6A4F', shadowOpacity: 0.09,
    shadowOffset: { width: 0, height: 3 }, shadowRadius: 10, elevation: 2,
  },
  signOutText: { fontFamily: fonts.bold, fontSize: 15, color: '#111111' },
  deleteBtn: { paddingVertical: 16, alignItems: 'center' },
  deleteText: { fontFamily: fonts.semiBold, fontSize: 14, color: '#D4183D' },

  devBtn: {
    marginTop: 8, paddingVertical: 12, alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 12,
  },
  devBtnText: { fontFamily: fonts.semiBold, fontSize: 13, color: '#717182' },
});

const pc = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'flex-end' },
  overlayBg: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    backgroundColor: '#F7FAF1', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 24, paddingBottom: 36, paddingTop: 14,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(45,106,79,0.08)',
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(0,0,0,0.12)', alignSelf: 'center', marginBottom: 20 },
  title: { fontFamily: fonts.extraBold, fontSize: 20, color: '#111111', letterSpacing: -0.4, marginBottom: 8 },
  body: { fontFamily: fonts.regular, fontSize: 14, color: '#4A6054', lineHeight: 20, marginBottom: 28 },
  confirmBtn: { backgroundColor: '#111111', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 10 },
  confirmBtnText: { fontFamily: fonts.bold, color: '#FFFFFF', fontSize: 16 },
  cancelBtn: { paddingVertical: 12, alignItems: 'center' },
  cancelBtnText: { fontFamily: fonts.semiBold, color: '#7A9080', fontSize: 15 },
});

const dm = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', padding: 28 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  card: {
    width: '100%', backgroundColor: '#FFFFFF', borderRadius: 24,
    padding: 26, shadowColor: '#000', shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22, shadowRadius: 24, elevation: 20,
  },
  title: { fontFamily: fonts.extraBold, fontSize: 22, color: '#111111', letterSpacing: -0.4, marginBottom: 10 },
  body: { fontFamily: fonts.regular, fontSize: 15, color: '#5c5c6e', lineHeight: 22, marginBottom: 28 },
  confirmBtn: { backgroundColor: '#111111', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 10 },
  confirmBtnFinal: { backgroundColor: '#D4183D' },
  confirmText: { fontFamily: fonts.bold, color: '#FFFFFF', fontSize: 16 },
  confirmTextFinal: { color: '#FFFFFF' },
  cancelBtn: { paddingVertical: 12, alignItems: 'center' },
  cancelText: { fontFamily: fonts.semiBold, color: '#717182', fontSize: 15 },
});
