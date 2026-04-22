import { ActivityIndicator, Image, KeyboardAvoidingView, Modal, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { normalizeCity, normalizeMoveInDate, normalizeState, normalizeZip } from './listingFormUtils';

type ListingPhotoItem = { kind: 'path'; path: string; url: string } | { kind: 'local'; uri: string };

type Props = {
  visible: boolean;
  listingExists: boolean;
  savingListing: boolean;
  editListingPhotos: ListingPhotoItem[];
  maxListingPhotos: number;
  editRent: string;
  editRoomType: string;
  editListingCity: string;
  editListingState: string;
  editListingZip: string;
  editAddress: string;
  editMoveInDate: string;
  setEditRent: (v: string) => void;
  setEditRoomType: (v: string) => void;
  setEditListingCity: (v: string) => void;
  setEditListingState: (v: string) => void;
  setEditListingZip: (v: string) => void;
  setEditAddress: (v: string) => void;
  setEditMoveInDate: (v: string) => void;
  setEditListingPhotos: (updater: (prev: ListingPhotoItem[]) => ListingPhotoItem[]) => void;
  onClose: () => void;
  onSave: () => void;
  onAddListingPhoto: () => void;
  styles: Record<string, unknown>;
  theme: { border: string; mutedForeground: string; primary: string };
  bottomInset: number;
};

export default function ListingModal({
  visible,
  listingExists,
  savingListing,
  editListingPhotos,
  maxListingPhotos,
  editRent,
  editRoomType,
  editListingCity,
  editListingState,
  editListingZip,
  editAddress,
  editMoveInDate,
  setEditRent,
  setEditRoomType,
  setEditListingCity,
  setEditListingState,
  setEditListingZip,
  setEditAddress,
  setEditMoveInDate,
  setEditListingPhotos,
  onClose,
  onSave,
  onAddListingPhoto,
  styles,
  theme,
  bottomInset,
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
        keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
      >
        <View style={styles.modalHeader as object}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.modalCancel as object}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle as object}>{listingExists ? 'Edit Listing' : 'Add Listing'}</Text>
          <TouchableOpacity onPress={onSave} disabled={savingListing}>
            {savingListing ? <ActivityIndicator color={theme.primary} /> : <Text style={styles.modalSave as object}>Save</Text>}
          </TouchableOpacity>
        </View>
        <ScrollView
          style={styles.modalScroll as object}
          contentContainerStyle={[
            styles.modalScrollContent as object,
            { paddingBottom: 40 + Math.max(bottomInset, 16) },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          {...(Platform.OS === 'ios' ? { automaticallyAdjustKeyboardInsets: true } : {})}
        >
          <Text style={styles.listingFieldLabel as object}>Photos ({editListingPhotos.length}/{maxListingPhotos})</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', gap: 8, paddingVertical: 4 }}>
              {editListingPhotos.map((item, idx) => (
                <View key={idx} style={{ position: 'relative' }}>
                  <Image
                    source={{ uri: item.kind === 'path' ? item.url : item.uri }}
                    style={{ width: 110, height: 82, borderRadius: 8, backgroundColor: '#ddd' }}
                  />
                  <TouchableOpacity
                    style={{ position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 10, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' }}
                    onPress={() => setEditListingPhotos((prev) => prev.filter((_, i) => i !== idx))}
                  >
                    <Text style={{ color: '#fff', fontSize: 13, lineHeight: 18 }}>×</Text>
                  </TouchableOpacity>
                </View>
              ))}
              {editListingPhotos.length < maxListingPhotos && (
                <TouchableOpacity
                  style={{ width: 110, height: 82, borderRadius: 8, borderWidth: 1.5, borderColor: theme.border, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' }}
                  onPress={onAddListingPhoto}
                >
                  <Text style={{ color: theme.mutedForeground, fontSize: 26, lineHeight: 30 }}>+</Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>

          <Text style={styles.listingFieldLabel as object}>Monthly Rent ($)</Text>
          <TextInput
            style={styles.listingInput as object}
            value={editRent}
            onChangeText={setEditRent}
            placeholder="e.g. 1200"
            placeholderTextColor="#9AA"
            keyboardType="numeric"
          />

          <Text style={styles.listingFieldLabel as object}>Room Type</Text>
          <View style={styles.chipsWrap as object}>
            {[
              { label: 'Private room', value: 'private' },
              { label: 'Shared room', value: 'shared' },
              { label: 'Studio', value: 'studio' },
              { label: 'Entire place', value: 'entire' },
            ].map((t) => (
              <TouchableOpacity
                key={t.value}
                style={[styles.chip as object, editRoomType === t.value && styles.chipOn as object]}
                onPress={() => setEditRoomType(t.value)}
              >
                <Text style={[styles.chipText as object, editRoomType === t.value && styles.chipTextOn as object]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.listingFieldLabel as object}>City</Text>
          <TextInput
            style={styles.listingInput as object}
            value={editListingCity}
            onChangeText={(text) => setEditListingCity(normalizeCity(text))}
            placeholder="e.g. Riverside"
            placeholderTextColor="#9AA"
          />

          <Text style={styles.listingFieldLabel as object}>State</Text>
          <TextInput
            style={styles.listingInput as object}
            value={editListingState}
            onChangeText={(text) => setEditListingState(normalizeState(text))}
            placeholder="e.g. CA"
            placeholderTextColor="#9AA"
            autoCapitalize="characters"
            maxLength={2}
          />

          <Text style={styles.listingFieldLabel as object}>ZIP Code</Text>
          <TextInput
            style={styles.listingInput as object}
            value={editListingZip}
            onChangeText={(text) => setEditListingZip(normalizeZip(text))}
            placeholder="e.g. 92507"
            placeholderTextColor="#9AA"
            keyboardType="numbers-and-punctuation"
            autoCapitalize="none"
            maxLength={10}
          />

          <Text style={styles.listingFieldLabel as object}>Address (optional)</Text>
          <TextInput
            style={styles.listingInput as object}
            value={editAddress}
            onChangeText={setEditAddress}
            placeholder="Street address"
            placeholderTextColor="#9AA"
          />

          <Text style={styles.listingFieldLabel as object}>Available From</Text>
          <TextInput
            style={styles.listingInput as object}
            value={editMoveInDate}
            onChangeText={(text) => setEditMoveInDate(normalizeMoveInDate(text))}
            placeholder="MM-DD-YYYY"
            placeholderTextColor="#9AA"
            keyboardType="numbers-and-punctuation"
            autoCapitalize="none"
            maxLength={10}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
