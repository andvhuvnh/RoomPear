import React from 'react';
import {
  Modal,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
} from 'react-native';

type Props = {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxHeight?: string | number;
  fullScreen?: boolean;
  presentationStyle?: 'fullScreen' | 'pageSheet' | 'formSheet' | 'overFullScreen';
  topInset?: number;
};

export default function DraggableSheet({
  visible,
  onClose,
  children,
  maxHeight = '90%',
  fullScreen = false,
  presentationStyle = 'fullScreen',
  topInset = 0,
}: Props) {
  if (fullScreen) {
    if (topInset > 0) {
      return (
        <Modal
          visible={visible}
          transparent
          animationType="slide"
          presentationStyle="overFullScreen"
          allowSwipeDismissal={false}
          onRequestClose={onClose}
        >
          <View style={[s.floatingStage, { paddingTop: topInset }]}>
            <View style={s.floatingSurface}>{children}</View>
          </View>
        </Modal>
      );
    }

    return (
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle={presentationStyle}
        allowSwipeDismissal={false}
        onRequestClose={onClose}
      >
        <View style={s.fullScreenSheet}>{children}</View>
      </Modal>
    );
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose} accessible={false}>
        <View style={[StyleSheet.absoluteFill, s.backdrop]} />
      </TouchableWithoutFeedback>
      <View style={s.container} pointerEvents="box-none">
        <View style={[s.sheet, { height: maxHeight, maxHeight }]}>
          {children}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
    elevation: 24,
  },
  fullScreenSheet: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  floatingStage: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.16)',
  },
  floatingSurface: {
    flex: 1,
    overflow: 'hidden',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: '#FFFFFF',
  },
});
