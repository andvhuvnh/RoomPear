import { Modal } from 'react-native';
import RoomPearPaywallContent, { type PaywallPlanId } from './RoomPearPaywallContent';

export type { PaywallPlanId };

type Props = {
  visible: boolean;
  onClose: () => void;
  onTryNativePurchaseFlow?: () => Promise<void>;
  onSelectPlan?: (plan: PaywallPlanId) => void;
};

export default function RoomPearPaywallModal({ visible, onClose, onTryNativePurchaseFlow, onSelectPlan }: Props) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <RoomPearPaywallContent
        onClose={onClose}
        onTryNativePurchaseFlow={onTryNativePurchaseFlow}
        onSelectPlan={onSelectPlan}
      />
    </Modal>
  );
}
