import { ActivityIndicator, Modal, ScrollView, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Listing } from '../../lib/listings';
import { formatAvailabilityForDisplay } from './listingFormUtils';

type Props = {
  visible: boolean;
  listing: Listing | null;
  /** Preferences-based area (same line as profile listing location). */
  searchLocationLine: string;
  profile: Record<string, any> | null;
  user: { id: string; email?: string } | null;
  referralDraft: string;
  referralBusy: boolean;
  setReferralDraft: (v: string) => void;
  onClose: () => void;
  onOpenEditName: () => void;
  onOpenListing: () => void;
  onDeleteListing: () => void;
  onCopyReferralCode: (code: string) => void;
  onApplyReferralCode: () => void;
  isPaused: boolean;
  onTogglePause: (value: boolean) => void;
  isPremium: boolean;
  onUpgradeToPlus: () => void;
  onManageSubscription: () => void;
  onSignOut: () => void;
  onDevShowOnboarding?: () => void;
  styles: Record<string, unknown>;
  theme: { foreground: string; mutedForeground: string; destructive: string; primaryForeground: string };
};

export default function SettingsModal({
  visible,
  listing,
  searchLocationLine,
  profile,
  user,
  referralDraft,
  referralBusy,
  setReferralDraft,
  onClose,
  onOpenEditName,
  onOpenListing,
  onDeleteListing,
  isPaused,
  onTogglePause,
  onCopyReferralCode,
  onApplyReferralCode,
  isPremium,
  onUpgradeToPlus,
  onManageSubscription,
  onSignOut,
  onDevShowOnboarding,
  styles,
  theme,
}: Props) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.settingsModalRoot as object}>
        <View style={styles.modalHeader as object}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.modalCancel as object}>Done</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle as object}>Settings</Text>
          <View style={{ width: 56 }} />
        </View>
        <ScrollView
          style={styles.settingsScroll as object}
          contentContainerStyle={styles.settingsScrollContent as object}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.settingsSectionLabel as object}>Basics</Text>
          <View style={styles.settingsGroup as object}>
            <TouchableOpacity
              style={styles.settingsRow as object}
              onPress={onOpenEditName}
            >
              <View style={styles.settingsRowLeft as object}>
                <Ionicons name="person-outline" size={20} color={theme.foreground} />
                <Text style={styles.settingsRowTitle as object}>Display name</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.mutedForeground} />
            </TouchableOpacity>
          </View>

          <Text style={styles.settingsHelp as object}>
            Edit photos, interests, and prompts from the profile tab — not here.
          </Text>

          <Text style={styles.settingsSectionLabel as object}>Your place</Text>
          <View style={styles.settingsGroup as object}>
            {listing ? (
              <>
                <View style={styles.settingsListingSummary as object}>
                  <Text style={styles.settingsListingTitle as object}>
                    {listing.room_type ?? 'Room'}
                    {searchLocationLine ? ` · ${searchLocationLine}` : ''}
                  </Text>
                  {listing.rent != null && (
                    <Text style={styles.settingsListingMeta as object}>${listing.rent}/mo</Text>
                  )}
                  {listing.move_in_date ? (
                    <Text style={styles.settingsListingSub as object}>
                      Available {formatAvailabilityForDisplay(listing.move_in_date)}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.settingsRowDivider as object} />
                <TouchableOpacity
                  style={styles.settingsRow as object}
                  onPress={onOpenListing}
                >
                  <View style={styles.settingsRowLeft as object}>
                    <Ionicons name="create-outline" size={20} color={theme.foreground} />
                    <Text style={styles.settingsRowTitle as object}>Edit listing</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={theme.mutedForeground} />
                </TouchableOpacity>
                <View style={styles.settingsRowDivider as object} />
                <TouchableOpacity style={styles.settingsRow as object} onPress={onDeleteListing}>
                  <View style={styles.settingsRowLeft as object}>
                    <Ionicons name="trash-outline" size={20} color={theme.destructive} />
                    <Text style={[styles.settingsRowTitle as object, { color: theme.destructive }]}>Remove listing</Text>
                  </View>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                style={styles.settingsRow as object}
                onPress={onOpenListing}
              >
                <View style={styles.settingsRowLeft as object}>
                  <Ionicons name="home-outline" size={20} color={theme.foreground} />
                  <Text style={styles.settingsRowTitle as object}>Add a place listing</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.mutedForeground} />
              </TouchableOpacity>
            )}
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

          <Text style={styles.settingsSectionLabel as object}>Account</Text>
          <View style={styles.settingsGroup as object}>
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
                onValueChange={onTogglePause}
                trackColor={{ false: '#D1D5DB', true: '#4A7C59' }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>

          <Text style={styles.settingsSectionLabel as object}>More</Text>
          <View style={styles.settingsGroup as object}>
            <View style={styles.settingsPlaceholderRow as object}>
              <View style={styles.settingsRowLeft as object}>
                <Ionicons name="notifications-outline" size={20} color={theme.mutedForeground} />
                <Text style={styles.settingsPlaceholderTitle as object}>Notifications</Text>
              </View>
              <Text style={styles.soonBadge as object}>Soon</Text>
            </View>
            <View style={styles.settingsRowDivider as object} />
            <View style={styles.settingsPlaceholderRow as object}>
              <View style={styles.settingsRowLeft as object}>
                <Ionicons name="shield-checkmark-outline" size={20} color={theme.mutedForeground} />
                <Text style={styles.settingsPlaceholderTitle as object}>Privacy & safety</Text>
              </View>
              <Text style={styles.soonBadge as object}>Soon</Text>
            </View>
            <View style={styles.settingsRowDivider as object} />
            <View style={styles.settingsPlaceholderRow as object}>
              <View style={styles.settingsRowLeft as object}>
                <Ionicons name="card-outline" size={20} color={theme.mutedForeground} />
                <Text style={styles.settingsPlaceholderTitle as object}>Subscription & billing</Text>
              </View>
              <Text style={styles.soonBadge as object}>Soon</Text>
            </View>
            <View style={styles.settingsRowDivider as object} />
            <View style={styles.settingsPlaceholderRow as object}>
              <View style={styles.settingsRowLeft as object}>
                <Ionicons name="help-circle-outline" size={20} color={theme.mutedForeground} />
                <Text style={styles.settingsPlaceholderTitle as object}>Help & support</Text>
              </View>
              <Text style={styles.soonBadge as object}>Soon</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.signOutButton as object} onPress={onSignOut}>
            <Text style={styles.signOutButtonText as object}>Sign out</Text>
          </TouchableOpacity>
          {__DEV__ && onDevShowOnboarding && (
            <TouchableOpacity style={styles.devButton as object} onPress={onDevShowOnboarding}>
              <Text style={styles.devButtonText as object}>DEV: Preview Onboarding</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}
