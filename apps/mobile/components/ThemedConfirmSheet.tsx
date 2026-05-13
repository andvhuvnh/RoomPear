import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '../lib/typography';

type Props = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  singleAction?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

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
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable onPress={(e) => e.stopPropagation()}>
          <LinearGradient
            colors={['#EDF5EA', '#F4F9F0', '#FAFDF7', '#FFFFFF']}
            locations={[0, 0.3, 0.65, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={[s.sheet, { paddingBottom: insets.bottom + 20 }]}
          >
            <View style={s.handle} />
            <Text style={s.title}>{title}</Text>
            <Text style={s.message}>{message}</Text>

            {singleAction ? (
              <TouchableOpacity
                style={[s.confirmBtn, s.confirmBtnFull, destructive && s.confirmBtnDestructive]}
                onPress={onConfirm}
                activeOpacity={0.85}
              >
                <Text style={s.confirmBtnText}>{confirmLabel}</Text>
              </TouchableOpacity>
            ) : (
              <View style={s.btnRow}>
                <TouchableOpacity style={s.cancelBtn} onPress={onClose} activeOpacity={0.8}>
                  <Text style={s.cancelBtnText}>{cancelLabel}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.confirmBtn, destructive && s.confirmBtnDestructive]}
                  onPress={onConfirm}
                  activeOpacity={0.85}
                >
                  <Text style={s.confirmBtnText}>{confirmLabel}</Text>
                </TouchableOpacity>
              </View>
            )}
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
    letterSpacing: -0.3, marginBottom: 8,
  },
  message: {
    fontFamily: fonts.regular,
    fontSize: 15, color: '#7A9080',
    lineHeight: 22, marginBottom: 24,
  },
  btnRow: { flexDirection: 'row', gap: 12 },
  cancelBtn: {
    flex: 1, paddingVertical: 15, borderRadius: 16,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1, borderColor: 'rgba(45,106,79,0.13)',
  },
  cancelBtnText: {
    fontFamily: fonts.semiBold, fontSize: 15, color: '#111111',
  },
  confirmBtn: {
    flex: 1, paddingVertical: 15, borderRadius: 16,
    alignItems: 'center',
    backgroundColor: '#111111',
  },
  confirmBtnFull: {
    flex: 0, alignSelf: 'stretch',
  },
  confirmBtnDestructive: {
    backgroundColor: '#D4183D',
  },
  confirmBtnText: {
    fontFamily: fonts.bold, fontSize: 15, color: '#FFFFFF',
  },
});
