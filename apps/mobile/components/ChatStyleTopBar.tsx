import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Flag } from 'phosphor-react-native';
import {
  CHATS_CARD,
  CHATS_GREEN,
  CHATS_GREEN_BORDER,
} from '../theme/chatsAmbient';

const ROUND = 22;
const BTN = 44;
const TEXT = '#1A2C24';

type Props = {
  title: string;
  onBack: () => void;
  topInset: number;
  backAccessibilityLabel?: string;
  onReport?: () => void;
};

/** Floating back + title pills (matches Chat screen) — overlay on scroll content. */
export function ChatStyleTopBar({
  title,
  onBack,
  topInset,
  backAccessibilityLabel = 'Go back',
  onReport,
}: Props) {
  return (
    <View style={[styles.wrap, { paddingTop: topInset }]} pointerEvents="box-none">
      <View style={styles.row}>
        <TouchableOpacity
          onPress={onBack}
          style={styles.roundBtn}
          accessibilityRole="button"
          accessibilityLabel={backAccessibilityLabel}
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
        >
          <Ionicons name="chevron-back" size={22} color={CHATS_GREEN} />
        </TouchableOpacity>

        <View style={styles.titleSlot} pointerEvents="none">
          <View style={styles.titleBubble}>
            <Text style={styles.titleText} numberOfLines={1}>
              {title || 'Profile'}
            </Text>
          </View>
        </View>

        {onReport ? (
          <TouchableOpacity
            onPress={onReport}
            style={styles.roundBtn}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          >
            <Flag size={20} color={CHATS_GREEN} />
          </TouchableOpacity>
        ) : (
          <View style={styles.balance} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  roundBtn: {
    width: BTN,
    height: BTN,
    borderRadius: BTN / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CHATS_CARD,
    borderWidth: 1,
    borderColor: CHATS_GREEN_BORDER,
    shadowColor: '#1A3329',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  titleSlot: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  titleBubble: {
    maxWidth: '100%',
    borderRadius: ROUND,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 11,
    backgroundColor: CHATS_CARD,
    borderWidth: 1,
    borderColor: CHATS_GREEN_BORDER,
    shadowColor: '#1A3329',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  titleText: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT,
    textAlign: 'center',
  },
  balance: {
    width: BTN,
  },
});
