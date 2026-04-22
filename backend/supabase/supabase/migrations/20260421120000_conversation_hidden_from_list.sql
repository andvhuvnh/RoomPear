-- Per-user "remove from Messages list" — does not delete the conversation or messages.

ALTER TABLE public.conversation_participants
ADD COLUMN IF NOT EXISTS hidden_from_list_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS conversation_participants_user_list_hidden_idx
  ON public.conversation_participants(user_id)
  WHERE hidden_from_list_at IS NOT NULL;

COMMENT ON COLUMN public.conversation_participants.hidden_from_list_at IS
  'When set, this user does not see the thread in their Messages list; the other participant is unchanged.';

-- When someone sends a message, show the thread again for recipients who had hidden it.
CREATE OR REPLACE FUNCTION public.message_clear_recipient_list_hide()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.conversation_participants
  SET hidden_from_list_at = NULL
  WHERE conversation_id = NEW.conversation_id
    AND user_id <> NEW.sender_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_message_insert_clear_list_hide ON public.messages;
CREATE TRIGGER on_message_insert_clear_list_hide
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.message_clear_recipient_list_hide();
