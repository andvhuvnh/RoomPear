import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CHATS_CARD,
  CHATS_GREEN,
  CHATS_GREEN_BORDER,
} from '../theme/chatsAmbient';

const TEXT = '#1A2C24';
const GRAY = '#717182';

type Props = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  /** Label for the left button in two-button mode (default “Cancel”). */
  cancelLabel?: string;
  destructive?: boolean;
  /** Only a single dismiss/confirm button (e.g. “OK”). */
  singleAction?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

/** Bottom-sheet style confirm — matches Chats ambient (no platform Alert). */
export default function ThemedConfirmSheet({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  singleAction = false,
  onConfirm,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          {singleAction ? (
            <TouchableOpacity
              style={[styles.confirmBtn, styles.confirmBtnFull, destructive && styles.confirmBtnDestructive]}
              onPress={onConfirm}
              activeOpacity={0.85}
            >
              <Text style={[styles.confirmBtnText, destructive && styles.confirmBtnTextOnDanger]}>
                {confirmLabel}
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.row}>
              <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.85}>
                <Text style={styles.cancelBtnText}>{cancelLabel}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, destructive && styles.confirmBtnDestructive]}
                onPress={onConfirm}
                activeOpacity={0.85}
              >
                <Text style={[styles.confirmBtnText, destructive && styles.confirmBtnTextOnDanger]}>
                  {confirmLabel}
                </Text>
              </TouchableOpacity>
            </View>
          )}
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
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: CHATS_GREEN_BORDER,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: TEXT,
    marginBottom: 8,
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    color: GRAY,
    marginBottom: 22,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: CHATS_GREEN_BORDER,
    alignItems: 'center',
    backgroundColor: '#FAFBFA',
  },
  cancelBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: CHATS_GREEN,
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: TEXT,
  },
  confirmBtnFull: {
    flex: 0,
    alignSelf: 'stretch',
  },
  confirmBtnDestructive: {
    backgroundColor: '#D4183D',
    borderWidth: 0,
  },
  confirmBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  confirmBtnTextOnDanger: {
    color: '#FFFFFF',
  },
});
