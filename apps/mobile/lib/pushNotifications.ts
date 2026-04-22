import { supabase } from './supabase';

/**
 * Send a push notification to another user via the send-notification edge function.
 * Silently no-ops if the recipient has no push token or permission denied.
 */
export async function sendPushNotification(
  recipientId: string,
  title: string,
  body: string
): Promise<void> {
  try {
    await supabase.functions.invoke('send-notification', {
      body: { recipient_id: recipientId, title, body },
    });
  } catch (e) {
    // Non-critical — never block the main action on notification failure
    console.warn('sendPushNotification failed', e);
  }
}
