import {
  Animated,
  Image,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCallback, useRef, useState } from 'react';
import { fonts } from '../../lib/typography';

type ListingPhotoItem = { kind: 'path'; path: string; url: string } | { kind: 'local'; uri: string };

type Props = {
  visible: boolean;
  listingExists: boolean;
  editListingPhotos: ListingPhotoItem[];
  maxListingPhotos: number;
  editRent: string;
  editRoomType: string;
  setEditRent: (v: string) => void;
  setEditRoomType: (v: string) => void;
  setEditListingPhotos: (updater: (prev: ListingPhotoItem[]) => ListingPhotoItem[]) => void;
  onClose: () => void;
  onAddListingPhoto: (replaceIndex?: number) => void;
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
  editListingPhotos,
  maxListingPhotos,
  editRent,
  editRoomType,
  setEditRent,
  setEditRoomType,
  setEditListingPhotos,
  onClose,
  onAddListingPhoto,
  bottomInset,
}: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const photoSlotWidth = Math.floor((width - 40 - 20) / 3);
  const photoSlotHeight = Math.round(photoSlotWidth / 0.78);
  const [photoActionIndex, setPhotoActionIndex] = useState<number | null>(null);
  const [draggingPhotoIndex, setDraggingPhotoIndex] = useState<number | null>(null);
  const dragOverPhotoIndexRef = useRef<number | null>(null);
  const photoGridRef = useRef<View | null>(null);
  const photoGridFrameRef = useRef({ x: 0, y: 0, width: 0, height: 0 });
  const photoDragRef = useRef<{ index: number; active: boolean } | null>(null);
  const photoDragTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const photoDragOffset = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const selectedPhoto = photoActionIndex != null ? editListingPhotos[photoActionIndex] : null;

  const closePhotoAction = () => setPhotoActionIndex(null);
  const removeSelectedPhoto = () => {
    const index = photoActionIndex;
    closePhotoAction();
    if (index == null) return;
    setEditListingPhotos((prev) => prev.filter((_, i) => i !== index));
  };
  const replaceSelectedPhoto = () => {
    const index = photoActionIndex;
    closePhotoAction();
    if (index == null) return;
    onAddListingPhoto(index);
  };
  const addPhoto = () => {
    closePhotoAction();
    onAddListingPhoto();
  };

  const measurePhotoGrid = useCallback(() => {
    photoGridRef.current?.measureInWindow((x, y, width, height) => {
      photoGridFrameRef.current = { x, y, width, height };
    });
  }, []);

  const photoIndexFromPagePoint = useCallback((pageX: number, pageY: number) => {
    const frame = photoGridFrameRef.current;
    if (!frame.width || !frame.height) return null;

    const gap = 10;
    const relX = pageX - frame.x;
    const relY = pageY - frame.y;
    if (relX < 0 || relY < 0 || relX > frame.width || relY > frame.height) return null;

    const col = Math.floor(relX / (photoSlotWidth + gap));
    const row = Math.floor(relY / (photoSlotHeight + gap));
    if (col < 0 || col > 2 || row < 0 || row > 1) return null;

    const inColX = relX - col * (photoSlotWidth + gap);
    const inRowY = relY - row * (photoSlotHeight + gap);
    if (inColX > photoSlotWidth || inRowY > photoSlotHeight) return null;

    const index = row * 3 + col;
    return index < editListingPhotos.length ? index : null;
  }, [editListingPhotos.length, photoSlotHeight, photoSlotWidth]);

  const reorderListingPhoto = useCallback((fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;

    setEditListingPhotos((prev) => {
      if (fromIndex < 0 || toIndex < 0 || fromIndex >= prev.length || toIndex >= prev.length) {
        return prev;
      }

      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }, [setEditListingPhotos]);

  const setPhotoDropTarget = useCallback((index: number | null) => {
    if (dragOverPhotoIndexRef.current === index) return;
    dragOverPhotoIndexRef.current = index;
  }, []);

  const resetPhotoDrag = useCallback(() => {
    if (photoDragTimerRef.current) {
      clearTimeout(photoDragTimerRef.current);
      photoDragTimerRef.current = null;
    }
    photoDragRef.current = null;
    photoDragOffset.setValue({ x: 0, y: 0 });
    setDraggingPhotoIndex(null);
    setPhotoDropTarget(null);
  }, [photoDragOffset, setPhotoDropTarget]);

  const createPhotoDragResponder = useCallback((index: number) => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      if (photoDragTimerRef.current) clearTimeout(photoDragTimerRef.current);
      photoDragOffset.setValue({ x: 0, y: 0 });
      measurePhotoGrid();
      photoDragRef.current = { index, active: false };
      photoDragTimerRef.current = setTimeout(() => {
        photoDragRef.current = { index, active: true };
        setDraggingPhotoIndex(index);
        setPhotoDropTarget(index);
      }, 180);
    },
    onPanResponderMove: (_, gestureState) => {
      if (!photoDragRef.current?.active) return;
      photoDragOffset.setValue({ x: gestureState.dx, y: gestureState.dy });
      setPhotoDropTarget(photoIndexFromPagePoint(gestureState.moveX, gestureState.moveY));
    },
    onPanResponderRelease: (_, gestureState) => {
      const from = photoDragRef.current?.index ?? index;
      const wasDragging = Boolean(photoDragRef.current?.active);
      const over = dragOverPhotoIndexRef.current ?? photoIndexFromPagePoint(gestureState.moveX, gestureState.moveY);
      resetPhotoDrag();

      if (wasDragging) {
        if (over != null && over !== from) reorderListingPhoto(from, over);
        return;
      }

      if (Math.abs(gestureState.dx) < 8 && Math.abs(gestureState.dy) < 8) {
        setPhotoActionIndex(index);
      }
    },
    onPanResponderTerminate: resetPhotoDrag,
  }), [measurePhotoGrid, photoDragOffset, photoIndexFromPagePoint, reorderListingPhoto, resetPhotoDrag, setPhotoDropTarget]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      presentationStyle="overFullScreen"
      allowSwipeDismissal={false}
      onRequestClose={onClose}
    >
      <View style={[s.modalStage, { paddingTop: insets.top + 12 }]}>
      <LinearGradient
        colors={['#F5E9C8', '#F8EED8', '#FAF3E4', '#FEFCF8', '#FFFFFF']}
        locations={[0, 0.25, 0.55, 0.80, 1]}
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
            <View style={{ width: 38 }} />
            <Text style={s.headerTitle}>{listingExists ? 'edit listing' : 'add your place'}</Text>
            <Pressable onPress={onClose} style={s.closeBtn} hitSlop={10}>
              <Ionicons name="chevron-down" size={24} color="#111111" />
            </Pressable>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={[s.scrollContent, { paddingBottom: 32 + Math.max(bottomInset, 16) }]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
            bounces={false}
            alwaysBounceVertical={false}
            overScrollMode="never"
            {...(Platform.OS === 'ios' ? { automaticallyAdjustKeyboardInsets: true } : {})}
          >
            {/* Photos */}
            <Text style={s.sectionLabel}>PHOTOS</Text>
            <Text style={s.sectionSub}>Tap to add or edit. Hold and drag to reorder.</Text>
            <View ref={photoGridRef} style={s.photoGrid} onLayout={measurePhotoGrid}>
              {Array.from({ length: maxListingPhotos }).map((_, idx) => {
                const item = editListingPhotos[idx];
                const hasPhoto = Boolean(item);
                const dragResponder = hasPhoto ? createPhotoDragResponder(idx) : null;
                const isDragging = draggingPhotoIndex === idx;
                const slotStyle = [
                  s.photoSlot,
                  {
                    width: photoSlotWidth,
                    height: photoSlotHeight,
                    marginRight: idx % 3 === 2 ? 0 : 10,
                    marginBottom: idx < 3 ? 10 : 0,
                  },
                  !hasPhoto && s.photoSlotEmpty,
                  isDragging && s.photoSlotDragging,
                ];
                const slotContent = hasPhoto ? (
                  <>
                    <Image
                      source={{ uri: item.kind === 'path' ? item.url : item.uri }}
                      style={s.photoThumbImg}
                    />
                    <View style={s.photoRemoveBtn}>
                      <Ionicons name="create-outline" size={13} color="#fff" />
                    </View>
                    {idx === 0 && (
                      <View style={s.mainBadge}>
                        <Text style={s.mainBadgeText}>Main</Text>
                      </View>
                    )}
                  </>
                ) : (
                  <>
                    <Ionicons name="camera-outline" size={28} color="#111111" />
                    <Text style={s.photoAddText}>Add</Text>
                  </>
                );

                return hasPhoto && dragResponder ? (
                  <Animated.View
                    key={`listing-photo-slot-${idx}`}
                    style={[
                      slotStyle,
                      isDragging && {
                        zIndex: 20,
                        elevation: 20,
                        transform: [
                          ...photoDragOffset.getTranslateTransform(),
                          { scale: 1.03 },
                        ],
                      },
                    ]}
                    {...dragResponder.panHandlers}
                  >
                    {slotContent}
                  </Animated.View>
                ) : (
                  <TouchableOpacity
                    key={`listing-photo-slot-${idx}`}
                    style={slotStyle}
                    onPress={() => setPhotoActionIndex(idx)}
                    activeOpacity={0.85}
                  >
                    {slotContent}
                  </TouchableOpacity>
                );
              })}
            </View>

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
          </ScrollView>
        </KeyboardAvoidingView>
        {photoActionIndex !== null && (
          <Pressable style={s.photoActionOverlay} onPress={closePhotoAction}>
            <Pressable
              style={[s.photoActionSheet, { paddingBottom: Math.max(insets.bottom, 16) + 14 }]}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={s.photoActionHandle} />
              <View style={s.photoActionHeader}>
                <View style={s.photoActionIconBadge}>
                  <Ionicons
                    name={selectedPhoto ? 'home-outline' : 'camera-outline'}
                    size={22}
                    color="#2D6A4F"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.photoActionTitle}>{selectedPhoto ? 'Edit listing photo' : 'Add listing photo'}</Text>
                  <Text style={s.photoActionSub}>
                    {selectedPhoto && photoActionIndex === 0 ? 'This is your main listing photo' : 'Changes save automatically'}
                  </Text>
                </View>
              </View>

              {selectedPhoto ? (
                <>
                  <TouchableOpacity style={s.photoActionPrimary} onPress={replaceSelectedPhoto} activeOpacity={0.86}>
                    <Ionicons name="swap-horizontal-outline" size={20} color="#FFFFFF" />
                    <Text style={s.photoActionPrimaryText}>Replace photo</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.photoActionDanger} onPress={removeSelectedPhoto} activeOpacity={0.84}>
                    <Ionicons name="trash-outline" size={20} color="#D4183D" />
                    <Text style={s.photoActionDangerText}>Remove photo</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity style={s.photoActionPrimary} onPress={addPhoto} activeOpacity={0.86}>
                  <Ionicons name="camera-outline" size={20} color="#FFFFFF" />
                  <Text style={s.photoActionPrimaryText}>Choose photo</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity style={s.photoActionCancel} onPress={closePhotoAction} activeOpacity={0.8}>
                <Text style={s.photoActionCancelText}>Cancel</Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        )}
      </LinearGradient>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  modalStage: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.16)',
  },
  root: {
    flex: 1,
    overflow: 'hidden',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
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

  scrollContent: { paddingHorizontal: 20, paddingTop: 4 },

  sectionLabel: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: '#111111',
    letterSpacing: 0.8,
    marginBottom: 5,
    marginTop: 16,
  },
  sectionSub: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: '#444444',
    marginBottom: 10,
    marginTop: -2,
  },

  // Photos
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  photoSlot: { position: 'relative', borderRadius: 14, alignItems: 'center', justifyContent: 'center', shadowColor: '#2D6A4F', shadowOpacity: 0.10, shadowOffset: { width: 0, height: 3 }, shadowRadius: 8, elevation: 3 },
  photoSlotDragging: { opacity: 0.95, shadowColor: '#2D6A4F', shadowOpacity: 0.24, shadowOffset: { width: 0, height: 8 }, shadowRadius: 16, elevation: 8 },
  photoSlotEmpty: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(180,130,60,0.30)', backgroundColor: 'rgba(255,255,255,0.72)', gap: 4 },
  photoThumbImg: { width: '100%', height: '100%', backgroundColor: '#C8D8CA', borderRadius: 14 },
  photoRemoveBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
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
  photoAddText: { fontFamily: fonts.semiBold, fontSize: 12, color: '#111111' },

  // Photo action sheet
  photoActionOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.34)', paddingHorizontal: 12, zIndex: 20 },
  photoActionSheet: { backgroundColor: '#F7FAF1', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.65)', shadowColor: '#000', shadowOpacity: 0.18, shadowOffset: { width: 0, height: -8 }, shadowRadius: 22, elevation: 22 },
  photoActionHandle: { alignSelf: 'center', width: 42, height: 5, borderRadius: 999, backgroundColor: 'rgba(45,106,79,0.18)', marginBottom: 16 },
  photoActionHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  photoActionIconBadge: { width: 44, height: 44, borderRadius: 15, backgroundColor: 'rgba(45,106,79,0.10)', alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(45,106,79,0.12)' },
  photoActionTitle: { fontFamily: fonts.extraBold, fontSize: 20, color: '#111111', letterSpacing: -0.4 },
  photoActionSub: { fontFamily: fonts.regular, fontSize: 13, color: '#7A9080', marginTop: 2 },
  photoActionPrimary: { minHeight: 56, borderRadius: 17, backgroundColor: '#111111', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, marginBottom: 10 },
  photoActionPrimaryText: { fontFamily: fonts.bold, fontSize: 16, color: '#FFFFFF', letterSpacing: -0.1 },
  photoActionDanger: { minHeight: 54, borderRadius: 17, backgroundColor: 'rgba(212,24,61,0.08)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(212,24,61,0.18)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, marginBottom: 10 },
  photoActionDangerText: { fontFamily: fonts.bold, fontSize: 16, color: '#D4183D', letterSpacing: -0.1 },
  photoActionCancel: { minHeight: 52, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.74)', alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,0,0,0.07)' },
  photoActionCancelText: { fontFamily: fonts.semiBold, fontSize: 15, color: '#5E6F62' },

  // Rent
  rentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(45,106,79,0.12)',
    shadowColor: '#2D6A4F',
    shadowOpacity: 0.10,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
    elevation: 2,
  },
  rentPrefix: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: 'rgba(0,0,0,0.08)',
  },
  rentPrefixText: { fontFamily: fonts.regular, fontSize: 18, color: '#111111' },
  rentInput: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 23,
    color: '#111111',
    paddingHorizontal: 14,
    paddingVertical: 8,
    letterSpacing: -0.5,
  },
  rentSuffix: { fontFamily: fonts.semiBold, fontSize: 15, color: '#8AA89A', paddingRight: 16 },

  // Room type grid
  roomTypeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  roomTypeCard: {
    width: '47.5%',
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderRadius: 13,
    borderWidth: 1,
    borderColor: 'rgba(45,106,79,0.10)',
    paddingVertical: 11,
    paddingHorizontal: 12,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
    shadowColor: '#2D6A4F',
    shadowOpacity: 0.09,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
    elevation: 2,
  },
  roomTypeCardOn: {
    backgroundColor: '#111111',
    borderColor: '#111111',
    shadowColor: '#111111',
    shadowOpacity: 0.18,
  },
  roomTypeLabel: { fontFamily: fonts.semiBold, fontSize: 14, color: '#111111' },
  roomTypeLabelOn: { color: '#FFFFFF' },
});
