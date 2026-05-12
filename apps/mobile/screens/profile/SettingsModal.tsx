import { ActivityIndicator, Animated, Dimensions, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  styles,
  theme,
}: Props) {
  const insets = useSafeAreaInsets();
  const screenSlide = useRef(new Animated.Value(SCREEN_WIDTH)).current;

  const startSlideIn = () => {
    screenSlide.setValue(SCREEN_WIDTH);
    Animated.spring(screenSlide, { toValue: 0, useNativeDriver: true, damping: 28, stiffness: 140, mass: 1 }).start();
  };

  const handleClose = () => {
    Animated.timing(screenSlide, { toValue: SCREEN_WIDTH, duration: 380, useNativeDriver: true }).start(() => onClose());
  };

  // Delete account confirmation
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
    {
      title: 'Delete your account?',
      body: 'Your profile, matches, and all messages will be permanently erased. This cannot be undone.',
      confirm: 'Yes, delete my account',
      cancel: 'Wait, go back',
    },
    {
      title: 'This is permanent.',
      body: 'Every match and conversation you have will be gone forever. There is no recovering them.',
      confirm: 'Delete my account forever',
      cancel: 'Keep my account',
    },
  ];

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
    if (value) {
      showPauseConfirm();
    } else {
      onTogglePause(false);
    }
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
      <Animated.View style={[styles.settingsModalRoot as object, { transform: [{ translateX: screenSlide }], paddingTop: insets.top - 8 }]}>
        <View style={styles.modalHeader as object}>
          <TouchableOpacity onPress={handleClose} style={s.backBtn} hitSlop={10} activeOpacity={0.75}>
            <View style={s.backBtnCircle}>
              <Ionicons name="chevron-back" size={22} color="#111111" />
            </View>
          </TouchableOpacity>
          <Text style={styles.modalTitle as object}>Settings</Text>
          <View style={{ width: 44 }} />
        </View>
        <ScrollView
          style={styles.settingsScroll as object}
          contentContainerStyle={styles.settingsScrollContent as object}
          showsVerticalScrollIndicator={false}
        >



          <Text style={styles.settingsSectionLabel as object}>Account</Text>
          <View style={[styles.settingsGroup as object, { paddingBottom: 4 }]}>
            {user?.email ? (
              <>
                <View style={styles.settingsInfoRow as object}>
                  <Text style={styles.settingsInfoLabel as object}>Email</Text>
                  <Text style={styles.settingsInfoValue as object}>{user.email}</Text>
                </View>
                <View style={styles.settingsRowDivider as object} />
              </>
            ) : null}
            {profile?.phone ? (
              <>
                <View style={styles.settingsInfoRow as object}>
                  <Text style={styles.settingsInfoLabel as object}>Phone</Text>
                  <Text style={styles.settingsInfoValue as object}>{profile.phone}</Text>
                </View>
                <View style={styles.settingsRowDivider as object} />
              </>
            ) : null}
            <View style={styles.settingsInfoRow as object}>
              <Text style={styles.settingsInfoLabel as object}>Plan</Text>
              <Text style={styles.settingsInfoValue as object}>
                {(profile?.subscription_tier as string) || 'free'}
              </Text>
            </View>
            <View style={styles.settingsRowDivider as object} />
            <TouchableOpacity
              style={styles.settingsRow as object}
              onPress={isPremium ? onManageSubscription : onUpgradeToPlus}
            >
              <View style={styles.settingsRowLeft as object}>
                <Ionicons
                  name={isPremium ? 'card-outline' : 'sparkles-outline'}
                  size={20}
                  color={theme.foreground}
                />
                <Text style={styles.settingsRowTitle as object}>
                  {isPremium ? 'Manage subscription' : 'Upgrade to RoomPear+'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.mutedForeground} />
            </TouchableOpacity>
          </View>

          <Text style={styles.settingsSectionLabel as object}>Invite friends</Text>
          <View style={styles.settingsGroup as object}>
            <Text style={styles.settingsInviteHelp as object}>
              Share your code. When a friend joins and applies it, you both get +1 bonus reveal on Likes.
            </Text>
            {profile?.referral_code ? (
              <View style={styles.referralCodeRow as object}>
                <Text style={styles.referralCodeText as object}>{profile.referral_code}</Text>
                <TouchableOpacity
                  style={styles.referralCopyBtn as object}
                  onPress={() => onCopyReferralCode(profile.referral_code as string)}
                >
                  <Text style={styles.referralCopyBtnText as object}>Copy</Text>
                </TouchableOpacity>
              </View>
            ) : null}
            {!profile?.referred_by_user_id ? (
              <>
                <Text style={styles.inviteLabel as object}>Have a friend&apos;s code?</Text>
                <TextInput
                  style={styles.referralInput as object}
                  placeholder="Enter code"
                  placeholderTextColor={theme.mutedForeground}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  value={referralDraft}
                  onChangeText={(t) => setReferralDraft(t.toUpperCase())}
                  editable={!referralBusy}
                />
                <TouchableOpacity
                  style={[styles.referralApplyBtn as object, referralBusy && styles.referralApplyBtnDim as object]}
                  onPress={onApplyReferralCode}
                  disabled={referralBusy}
                >
                  {referralBusy ? (
                    <ActivityIndicator color={theme.primaryForeground} />
                  ) : (
                    <Text style={styles.referralApplyBtnText as object}>Apply code</Text>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <Text style={styles.inviteLinked as object}>You joined with a friend&apos;s referral.</Text>
            )}
          </View>

          <Text style={styles.settingsSectionLabel as object}>Visibility</Text>
          <View style={styles.settingsGroup as object}>
            <View style={styles.settingsRow as object}>
              <View style={styles.settingsRowLeft as object}>
                <Ionicons name="pause-circle-outline" size={20} color={theme.foreground} />
                <View>
                  <Text style={styles.settingsRowTitle as object}>Pause my profile</Text>
                  <Text style={[styles.settingsInfoLabel as object, { fontSize: 12 }]}>
                    {isPaused ? 'Hidden from discover' : 'Visible to others'}
                  </Text>
                </View>
              </View>
              <Switch
                value={isPaused}
                onValueChange={handleSwitchChange}
                trackColor={{ false: '#D1D5DB', true: '#4A7C59' }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>

          <Text style={styles.settingsSectionLabel as object}>Privacy & safety</Text>
          <View style={styles.settingsGroup as object}>
            <TouchableOpacity style={styles.settingsRow as object} onPress={onOpenBlockedUsers}>
              <View style={styles.settingsRowLeft as object}>
                <Ionicons name="ban-outline" size={20} color={theme.foreground} />
                <Text style={styles.settingsRowTitle as object}>Blocked users</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.mutedForeground} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.signOutButton as object} onPress={onSignOut}>
            <Text style={styles.signOutButtonText as object}>Sign out</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.deleteAccountBtn} onPress={showDeleteModal} activeOpacity={0.7}>
            <Text style={s.deleteAccountText}>Delete account</Text>
          </TouchableOpacity>

          {__DEV__ && onDevTogglePremium && (
            <View style={[styles.settingsGroup as object, { marginTop: 12 }]}>
              <View style={styles.settingsRow as object}>
                <View style={styles.settingsRowLeft as object}>
                  <Ionicons name="sparkles-outline" size={20} color={theme.foreground} />
                  <View>
                    <Text style={styles.settingsRowTitle as object}>DEV: Premium account</Text>
                    <Text style={[styles.settingsInfoLabel as object, { fontSize: 12 }]}>
                      Toggle to test premium-only features
                    </Text>
                  </View>
                </View>
                {devPremiumBusy ? (
                  <ActivityIndicator color={theme.foreground} />
                ) : (
                  <Switch
                    value={isPremium}
                    onValueChange={onDevTogglePremium}
                    trackColor={{ false: '#D1D5DB', true: '#4A7C59' }}
                    thumbColor="#FFFFFF"
                  />
                )}
              </View>
            </View>
          )}
          {__DEV__ && onDevShowOnboarding && (
            <TouchableOpacity style={styles.devButton as object} onPress={onDevShowOnboarding}>
              <Text style={styles.devButtonText as object}>DEV: Preview Onboarding</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      {pauseConfirmVisible && (
        <Pressable style={pc.overlay} onPress={() => hidePauseConfirm()}>
          <Animated.View style={[pc.overlayBg, { opacity: overlayOpacity }]} pointerEvents="none" />
          <Pressable onPress={() => {}}>
            <Animated.View style={[pc.sheet, { transform: [{ translateY: slideAnim }] }]}>
              <View style={pc.handle} />
              <Text style={pc.title}>Pause your profile?</Text>
              <Text style={pc.body}>You won't appear in anyone's discover until you unpause. You can still chat with your existing matches.</Text>
              <TouchableOpacity
                style={pc.confirmBtn}
                activeOpacity={0.85}
                onPress={() => hidePauseConfirm(() => onTogglePause(true))}
              >
                <Text style={pc.confirmBtnText}>Yes, pause it</Text>
              </TouchableOpacity>
              <TouchableOpacity style={pc.cancelBtn} activeOpacity={0.7} onPress={() => hidePauseConfirm()}>
                <Text style={pc.cancelBtnText}>Never mind</Text>
              </TouchableOpacity>
            </Animated.View>
          </Pressable>
        </Pressable>
      )}

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
  backBtn: { alignItems: 'flex-start', justifyContent: 'center' },
  deleteAccountBtn: { paddingVertical: 16, alignItems: 'center' },
  deleteAccountText: { fontSize: 14, color: '#D4183D', fontWeight: '500' },
  backBtnCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
});

const pc = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'flex-end' },
  overlayBg: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingBottom: 36,
    paddingTop: 14,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(0,0,0,0.15)', alignSelf: 'center', marginBottom: 20 },
  title: { fontSize: 20, fontWeight: '700', color: '#111111', marginBottom: 8 },
  body: { fontSize: 14, color: '#717182', lineHeight: 20, marginBottom: 28 },
  confirmBtn: { backgroundColor: '#111111', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 10 },
  confirmBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  cancelBtn: { paddingVertical: 12, alignItems: 'center' },
  cancelBtnText: { color: '#717182', fontSize: 15, fontWeight: '500' },
});

const dm = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', padding: 28 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  card: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 26,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 20,
  },
  title: { fontSize: 22, fontWeight: '800', color: '#111111', marginBottom: 10, letterSpacing: -0.4 },
  body: { fontSize: 15, color: '#5c5c6e', lineHeight: 22, marginBottom: 28 },
  confirmBtn: { backgroundColor: '#111111', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 10 },
  confirmBtnFinal: { backgroundColor: '#D4183D' },
  confirmText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  confirmTextFinal: { color: '#FFFFFF' },
  cancelBtn: { paddingVertical: 12, alignItems: 'center' },
  cancelText: { color: '#717182', fontSize: 15, fontWeight: '500' },
});
