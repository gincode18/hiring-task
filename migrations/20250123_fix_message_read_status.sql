BEGIN;

-- Create a security definer function to check if a user participates in a chat
-- This function can safely check chat_participants without triggering RLS recursion
CREATE OR REPLACE FUNCTION user_participates_in_chat(chat_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM chat_participants 
    WHERE chat_id = chat_uuid AND user_id = user_uuid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing policies that we're going to recreate
-- Messages table policies
DROP POLICY IF EXISTS "Users can mark messages as read in chats they participate in" ON messages;
DROP POLICY IF EXISTS "Users can read messages in chats they created" ON messages;
DROP POLICY IF EXISTS "Users can send messages to any chat" ON messages;
DROP POLICY IF EXISTS "Users can send messages to chats they participate in" ON messages;
DROP POLICY IF EXISTS "Users can read messages they sent" ON messages;
DROP POLICY IF EXISTS "Users can read messages in chats they participate in" ON messages;
DROP POLICY IF EXISTS "Users can update their own messages" ON messages;

-- Chat table policies
DROP POLICY IF EXISTS "Users can read chats they created" ON chats;
DROP POLICY IF EXISTS "Users can update chats they created" ON chats;
DROP POLICY IF EXISTS "Users can read chats they participate in or created" ON chats;
DROP POLICY IF EXISTS "Users can update chats they participate in or created" ON chats;

-- Chat participants table policies
DROP POLICY IF EXISTS "Users can read participants of chats they created" ON chat_participants;
DROP POLICY IF EXISTS "Users can add participants to chats they created" ON chat_participants;
DROP POLICY IF EXISTS "Users can read participants of chats they participate in or created" ON chat_participants;
DROP POLICY IF EXISTS "Users can add participants to chats they created or participate in" ON chat_participants;

-- Recreate all policies with proper participation checking

-- Messages table policies
CREATE POLICY "Users can send messages to chats they participate in"
  ON messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND user_participates_in_chat(chat_id, auth.uid())
  );

CREATE POLICY "Users can read messages in chats they participate in"
  ON messages
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR user_participates_in_chat(chat_id, auth.uid())
  );

CREATE POLICY "Users can update their own messages"
  ON messages
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can mark messages as read in chats they participate in"
  ON messages
  FOR UPDATE
  TO authenticated
  USING (
    user_participates_in_chat(chat_id, auth.uid())
  )
  WITH CHECK (
    user_participates_in_chat(chat_id, auth.uid())
  );

-- Chat table policies
CREATE POLICY "Users can read chats they participate in or created"
  ON chats
  FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid() OR user_participates_in_chat(id, auth.uid())
  );

CREATE POLICY "Users can update chats they participate in or created"
  ON chats
  FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid() OR user_participates_in_chat(id, auth.uid())
  );

-- Chat participants table policies
CREATE POLICY "Users can read participants of chats they participate in or created"
  ON chat_participants
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM chats
      WHERE chats.id = chat_participants.chat_id
      AND chats.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can add participants to chats they created or participate in"
  ON chat_participants
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM chats
      WHERE chats.id = chat_participants.chat_id
      AND (chats.created_by = auth.uid() OR user_participates_in_chat(chats.id, auth.uid()))
    )
  );

COMMIT; 