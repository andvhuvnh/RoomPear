import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { fonts } from '../../lib/typography';

type ListingPhotoItem = { kind: 'path'; path: string; url: string } | { kind: 'local'; uri: string };

type Props = {
  visible: boolean;
  listingExists: boolean;
  savingListing: boolean;
  editListingPhotos: ListingPhotoItem[];
  maxListingPhotos: number;
  editRent: string;
  editRoomType: string;
  setEditRent: (v: string) => void;
  setEditRoomType: (v: string) => void;
  setEditListingPhotos: (updater: (prev: ListingPhotoItem[]) => ListingPhotoItem[]) => void;
  onClose: () => void;
  onSave: () => void;
  onAddListingPhoto: () => void;
  styles: Record<string, unknown>;
  theme: { border: string; mutedForeground: string; primary: string };
  bottomInset: number;
};

const ROOM_TYPES = [
  { label: 'Private room', value: 'private', icon: 'bed-outline' },
  { label: 'Shared room', value: 'shared', icon: 'people-outline' },
  { label: 'Studio', value: 'studio', icon: 'home-outline' },
  { label: 'Entire place', value: 'entire', icon: 'business-outline' },
] as const;

export default function ListingModal({
  visible,
  listingExists,
  savingListing,
  editListingPhotos,
  maxListingPhotos,
  editRent,
  editRoomType,
  setEditRent,
  setEditRoomType,
  setEditListingPhotos,
  onClose,
  onSave,
  onAddListingPhoto,
  bottomInset,
}: Props) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <LinearGradient
        colors={['#C8EAC0', '#D4EEB8', '#E2F0C8', '#EEF6E0', '#F6FAF0', '#FFFFFF']}
        locations={[0, 0.18, 0.40, 0.62, 0.82, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={s.root}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
        >
          {/* Header */}
          <View style={s.header}>
            <Pressable onPress={onClose} style={s.closeBtn} hitSlop={10}>
              <Ionicons name="close" size={22} color="#111111" />
            </Pressable>
            <Text style={s.headerTitle}>{listingExists ? 'edit listing' : 'add your place'}</Text>
            <View style={{ width: 38 }} />
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={[s.scrollContent, { paddingBottom: 32 + Math.max(bottomInset, 16) }]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
            {...(Platform.OS === 'ios' ? { automaticallyAdjustKeyboardInsets: true } : {})}
          >
            {/* Photos */}
            <Text style={s.sectionLabel}>PHOTOS</Text>
            <Text style={s.sectionSub}>Show off your space — up to {maxListingPhotos} photos</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.photoScroll} contentContainerStyle={s.photoScrollContent}>
              {editListingPhotos.map((item, idx) => (
                <View key={idx} style={s.photoThumb}>
                  <Image
                    source={{ uri: item.kind === 'path' ? item.url : item.uri }}
                    style={s.photoThumbImg}
                  />
                  <TouchableOpacity
                    style={s.photoRemoveBtn}
                    onPress={() => setEditListingPhotos((prev) => prev.filter((_, i) => i !== idx))}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="close" size={12} color="#fff" />
                  </TouchableOpacity>
                  {idx === 0 && (
                    <View style={s.mainBadge}>
                      <Text style={s.mainBadgeText}>Main</Text>
                    </View>
                  )}
                </View>
              ))}
              {editListingPhotos.length < maxListingPhotos && (
                <TouchableOpacity style={s.photoAddBtn} onPress={onAddListingPhoto} activeOpacity={0.8}>
                  <Ionicons name="camera-outline" size={26} color="#6A8070" />
                  <Text style={s.photoAddText}>Add</Text>
                </TouchableOpacity>
              )}
            </ScrollView>

            {/* Rent */}
            <Text style={s.sectionLabel}>MONTHLY RENT</Text>
            <View style={s.rentRow}>
              <View style={s.rentPrefix}>
                <Text style={s.rentPrefixText}>$</Text>
              </View>
              <TextInput
                style={s.rentInput}
                value={editRent}
                onChangeText={setEditRent}
                placeholder="0"
                placeholderTextColor="rgba(0,0,0,0.25)"
                keyboardType="numeric"
              />
              <Text style={s.rentSuffix}>/mo</Text>
            </View>

            {/* Room type */}
            <Text style={s.sectionLabel}>ROOM TYPE</Text>
            <View style={s.roomTypeGrid}>
              {ROOM_TYPES.map((t) => {
                const on = editRoomType === t.value;
                return (
                  <TouchableOpacity
                    key={t.value}
                    style={[s.roomTypeCard, on && s.roomTypeCardOn]}
                    onPress={() => setEditRoomType(t.value)}
                    activeOpacity={0.85}
                  >
                    <Ionicons name={t.icon as any} size={22} color={on ? '#fff' : '#6A8070'} />
                    <Text style={[s.roomTypeLabel, on && s.roomTypeLabelOn]}>{t.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Save */}
            <TouchableOpacity style={s.saveBtn} onPress={onSave} disabled={savingListing} activeOpacity={0.88}>
              {savingListing
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.saveBtnText}>{listingExists ? 'save changes' : 'post listing'}</Text>}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  headerTitle: {
    fontFamily: fonts.extraBold,
    fontSize: 20,
    color: '#111111',
    letterSpacing: -0.4,
  },

  scrollContent: { paddingHorizontal: 20, paddingTop: 8 },

  sectionLabel: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: '#7A9080',
    letterSpacing: 0.8,
    marginBottom: 6,
    marginTop: 22,
  },
  sectionSub: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: '#8AA89A',
    marginBottom: 12,
    marginTop: -2,
  },

  // Photos
  photoScroll: { flexGrow: 0 },
  photoScrollContent: { flexDirection: 'row', gap: 10, paddingBottom: 4 },
  photoThumb: { position: 'relative', borderRadius: 14, overflow: 'hidden' },
  photoThumbImg: { width: 120, height: 90, borderRadius: 14, backgroundColor: '#C8D8CA' },
  photoRemoveBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  mainBadgeText: { fontFamily: fonts.bold, fontSize: 10, color: '#fff', letterSpacing: 0.3 },
  photoAddBtn: {
    width: 120,
    height: 90,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(106,128,112,0.4)',
    backgroundColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  photoAddText: { fontFamily: fonts.semiBold, fontSize: 12, color: '#6A8070' },

  // Rent
  rentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.08)',
    overflow: 'hidden',
  },
  rentPrefix: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: 'rgba(0,0,0,0.08)',
  },
  rentPrefixText: { fontFamily: fonts.bold, fontSize: 20, color: '#111111' },
  rentInput: {
    flex: 1,
    fontFamily: fonts.extraBold,
    fontSize: 28,
    color: '#111111',
    paddingHorizontal: 16,
    paddingVertical: 14,
    letterSpacing: -0.5,
  },
  rentSuffix: { fontFamily: fonts.semiBold, fontSize: 15, color: '#8AA89A', paddingRight: 16 },

  // Room type grid
  roomTypeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  roomTypeCard: {
    width: '47.5%',
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.08)',
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: 'flex-start',
    gap: 8,
  },
  roomTypeCardOn: {
    backgroundColor: '#111111',
    borderColor: '#111111',
  },
  roomTypeLabel: { fontFamily: fonts.semiBold, fontSize: 14, color: '#111111' },
  roomTypeLabelOn: { color: '#FFFFFF' },

  // Save
  saveBtn: {
    marginTop: 28,
    backgroundColor: '#111111',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: { fontFamily: fonts.bold, fontSize: 17, color: '#FFFFFF', letterSpacing: -0.2 },
});
