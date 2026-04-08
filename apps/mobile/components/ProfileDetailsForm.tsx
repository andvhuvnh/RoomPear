import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';

export type ProfileDetailsFormProps = {
  variant: 'screen' | 'modal';
  showName?: boolean;
  name?: string;
  onChangeName?: (v: string) => void;
  bio: string;
  onChangeBio: (v: string) => void;
  occupation: string;
  onChangeOccupation: (v: string) => void;
  hobbies: string[];
  hobbyDraft: string;
  onChangeHobbyDraft: (v: string) => void;
  onAddHobby: () => void;
  onRemoveHobby: (h: string) => void;
  footerHint?: string;
};

export default function ProfileDetailsForm({
  variant,
  showName,
  name,
  onChangeName,
  bio,
  onChangeBio,
  occupation,
  onChangeOccupation,
  hobbies,
  hobbyDraft,
  onChangeHobbyDraft,
  onAddHobby,
  onRemoveHobby,
  footerHint,
}: ProfileDetailsFormProps) {
  const S = variant === 'modal' ? modalStyles : screenStyles;
  const canAddHobby =
    Boolean(hobbyDraft.trim()) && hobbies.length < 10;

  return (
    <View>
      {showName && onChangeName ? (
        <View style={S.section}>
          <Text style={S.label}>Name</Text>
          <TextInput
            style={S.input}
            value={name ?? ''}
            onChangeText={onChangeName}
            placeholder="Your name"
            placeholderTextColor={variant === 'modal' ? '#189AA280' : '#189AA2'}
          />
        </View>
      ) : null}

      <View style={S.section}>
        <Text style={S.label}>Bio (optional)</Text>
        <TextInput
          style={[S.input, S.bioInput]}
          placeholder="Tell us about yourself..."
          value={bio}
          onChangeText={onChangeBio}
          multiline
          numberOfLines={4}
          maxLength={500}
          textAlignVertical="top"
          placeholderTextColor={variant === 'modal' ? '#189AA280' : '#189AA2'}
        />
        {variant === 'screen' ? (
          <Text style={screenStyles.charCount}>{bio.length}/500</Text>
        ) : null}
      </View>

      <View style={S.section}>
        <Text style={S.label}>Occupation (optional)</Text>
        <TextInput
          style={S.input}
          placeholder="What do you do?"
          value={occupation}
          onChangeText={onChangeOccupation}
          maxLength={100}
          placeholderTextColor={variant === 'modal' ? '#189AA280' : '#189AA2'}
        />
      </View>

      <View style={S.section}>
        <Text style={S.label}>Hobbies & Interests (optional)</Text>
        <View style={S.hobbyInputRow}>
          <TextInput
            style={[S.input, S.hobbyInput]}
            placeholder="Add a hobby or interest"
            value={hobbyDraft}
            onChangeText={onChangeHobbyDraft}
            onSubmitEditing={onAddHobby}
            returnKeyType="done"
            placeholderTextColor={variant === 'modal' ? '#189AA280' : '#189AA2'}
          />
          <TouchableOpacity
            style={S.addButton}
            onPress={onAddHobby}
            disabled={!canAddHobby}
          >
            <Text style={S.addButtonText}>Add</Text>
          </TouchableOpacity>
        </View>
        {hobbies.length > 0 ? (
          <View style={S.hobbiesWrap}>
            {hobbies.map((hobby, index) => (
              <TouchableOpacity
                key={`${hobby}-${index}`}
                style={S.hobbyTag}
                onPress={() => onRemoveHobby(hobby)}
              >
                <Text style={S.hobbyText}>{hobby}</Text>
                <Text style={S.hobbyRemove}>×</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
        <Text style={S.hint}>Add up to 10 hobbies or interests</Text>
      </View>

      {footerHint ? <Text style={S.footerHint}>{footerHint}</Text> : null}
    </View>
  );
}

const screenStyles = StyleSheet.create({
  section: {
    marginBottom: 32,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0C5389',
    marginBottom: 12,
  },
  input: {
    backgroundColor: '#FDFDFD',
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    color: '#0C5389',
    borderWidth: 1,
    borderColor: '#D9E1E6',
  },
  bioInput: {
    minHeight: 100,
    marginBottom: 8,
  },
  charCount: {
    fontSize: 12,
    color: '#189AA2',
    textAlign: 'right',
  },
  hobbyInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  hobbyInput: {
    flex: 1,
    marginRight: 12,
    marginBottom: 0,
  },
  addButton: {
    backgroundColor: '#189AA2',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 15,
    justifyContent: 'center',
  },
  addButtonText: {
    color: '#FDFDFD',
    fontSize: 16,
    fontWeight: '600',
  },
  hobbiesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  hobbyTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#189AA2',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  hobbyText: {
    color: '#FDFDFD',
    fontSize: 14,
    fontWeight: '500',
  },
  hobbyRemove: {
    color: '#FDFDFD',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 4,
    lineHeight: 18,
  },
  hint: {
    fontSize: 14,
    color: '#189AA2',
  },
  footerHint: {
    fontSize: 13,
    color: '#189AA2',
    opacity: 0.85,
    lineHeight: 18,
    marginTop: 4,
  },
});

const modalStyles = StyleSheet.create({
  section: {
    marginBottom: 18,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0C5389',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F5F8FA',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#0C5389',
    marginBottom: 0,
    borderWidth: 1,
    borderColor: '#D9E1E6',
  },
  bioInput: {
    minHeight: 100,
    marginBottom: 0,
  },
  hobbyInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  hobbyInput: {
    flex: 1,
    marginRight: 8,
    marginBottom: 0,
  },
  addButton: {
    backgroundColor: '#189AA2',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
  },
  addButtonText: {
    color: '#FDFDFD',
    fontWeight: '600',
  },
  hobbiesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  hobbyTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#189AA2',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
  },
  hobbyText: {
    color: '#FDFDFD',
    fontSize: 14,
  },
  hobbyRemove: {
    color: '#FDFDFD',
    fontSize: 14,
    opacity: 0.9,
    marginLeft: 2,
  },
  hint: {
    fontSize: 13,
    color: '#189AA2',
    opacity: 0.85,
  },
  footerHint: {
    fontSize: 13,
    color: '#189AA2',
    opacity: 0.85,
    lineHeight: 18,
    marginTop: 8,
  },
});
