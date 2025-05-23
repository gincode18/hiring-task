BEGIN;

-- Drop existing problematic policies and create new ones with proper participation logic

-- First, let's create a function to check if a user participates in a chat
CREATE OR REPLACE FUNCTION user_participates_in_chat(chat_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM chat_participants 
    WHERE chat_id = chat_uuid AND user_id = user_uuid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop all existing chat policies
DROP POLICY IF EXISTS "Users can read chats they created" ON chats;
DROP POLICY IF EXISTS "Users can update chats they created" ON chats;
DROP POLICY IF EXISTS "Users can read chats they participate in" ON chats;
DROP POLICY IF EXISTS "Users can update chats they participate in" ON chats;

CREATE POLICY "Users can read chats they created or participate in"
  ON chats
  FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid() OR 
    user_participates_in_chat(id, auth.uid())
  );

CREATE POLICY "Users can update chats they created or participate in"
  ON chats
  FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid() OR 
    user_participates_in_chat(id, auth.uid())
  );

-- Drop all existing chat_participants policies
DROP POLICY IF EXISTS "Users can read their own participation records" ON chat_participants;
DROP POLICY IF EXISTS "Users can read participants of chats they created" ON chat_participants;
DROP POLICY IF EXISTS "Users can read participants of chats they participate in" ON chat_participants;

CREATE POLICY "Users can read participants in chats they participate in or created"
  ON chat_participants
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM chats
      WHERE chats.id = chat_participants.chat_id
      AND (chats.created_by = auth.uid() OR user_participates_in_chat(chats.id, auth.uid()))
    )
  );

-- Drop all existing messages policies
DROP POLICY IF EXISTS "Users can send messages to any chat" ON messages;
DROP POLICY IF EXISTS "Users can read messages they sent" ON messages;
DROP POLICY IF EXISTS "Users can read messages in chats they created" ON messages;
DROP POLICY IF EXISTS "Users can send messages to chats they participate in" ON messages;
DROP POLICY IF EXISTS "Users can read messages in chats they participate in" ON messages;

CREATE POLICY "Users can send messages to chats they participate in"
  ON messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND
    user_participates_in_chat(chat_id, auth.uid())
  );

CREATE POLICY "Users can read messages in chats they participate in or created"
  ON messages
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM chats
      WHERE chats.id = messages.chat_id
      AND (chats.created_by = auth.uid() OR user_participates_in_chat(chats.id, auth.uid()))
    )
  );

COMMIT; 