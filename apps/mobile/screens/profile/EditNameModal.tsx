import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

type Props = {
  visible: boolean;
  savingProfile: boolean;
  editName: string;
  setEditName: (v: string) => void;
  onClose: () => void;
  onSave: () => void;
  styles: Record<string, unknown>;
  theme: { mutedForeground: string; primary: string };
};

export default function EditNameModal({
  visible,
  savingProfile,
  editName,
  setEditName,
  onClose,
  onSave,
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
      <KeyboardAvoidingView
        style={styles.modalRoot as object}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalHeader as object}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.modalCancel as object}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle as object}>Display name</Text>
          <TouchableOpacity onPress={onSave} disabled={savingProfile}>
            {savingProfile ? (
              <ActivityIndicator color={theme.primary} />
            ) : (
              <Text style={styles.modalSave as object}>Save</Text>
            )}
          </TouchableOpacity>
        </View>
        <ScrollView
          style={styles.modalScroll as object}
          contentContainerStyle={styles.modalScrollContent as object}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.nameFieldLabel as object}>Name</Text>
          <TextInput
            style={styles.nameInput as object}
            value={editName}
            onChangeText={setEditName}
            placeholder="Your name"
            placeholderTextColor={theme.mutedForeground}
            autoCapitalize="words"
          />
          <Text style={styles.nameFieldHint as object}>
            City and location come from onboarding.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
