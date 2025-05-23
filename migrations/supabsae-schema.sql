BEGIN;

/*
  # Initial database schema

  1. New Tables
    - `profiles` - User profiles with personal information
    - `chats` - Chat conversations (groups or direct messages)
    - `chat_participants` - Links users to chats they're part of
    - `messages` - Individual messages in chats

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage their own data
*/

-- First create all tables
-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  phone_number TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_seen TIMESTAMPTZ
);

-- Create chats table
CREATE TABLE IF NOT EXISTS chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  type TEXT NOT NULL DEFAULT 'direct',
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES profiles(id),
  is_demo BOOLEAN DEFAULT false,
  is_internal BOOLEAN DEFAULT false,
  is_signup BOOLEAN DEFAULT false,
  is_content BOOLEAN DEFAULT false,
  last_message_at TIMESTAMPTZ
);

-- Create chat participants table
CREATE TABLE IF NOT EXISTS chat_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT now(),
  role TEXT DEFAULT 'member',
  is_muted BOOLEAN DEFAULT false,
  is_pinned BOOLEAN DEFAULT false,
  UNIQUE(chat_id, user_id)
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  type TEXT DEFAULT 'text'
);

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

-- Now add RLS and policies to all tables
-- Profiles RLS and policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read all profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create their own profile"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Chats RLS and policies
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create chats"
  ON chats
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

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

-- Chat participants RLS and policies
ALTER TABLE chat_participants ENABLE ROW LEVEL SECURITY;

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

CREATE POLICY "Users can read their own participation records"
  ON chat_participants
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

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

CREATE POLICY "Users can update their own participation"
  ON chat_participants
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- Messages RLS and policies
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

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

-- Create function to update last_message_at in chat when a message is inserted
CREATE OR REPLACE FUNCTION update_last_message_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE chats
  SET last_message_at = NEW.created_at
  WHERE id = NEW.chat_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_chat_last_message
AFTER INSERT ON messages
FOR EACH ROW
EXECUTE FUNCTION update_last_message_timestamp();

-- Enable realtime for all tables
ALTER PUBLICATION supabase_realtime ADD TABLE chats, chat_participants, messages, profiles;

-- Configure the realtime payload
ALTER TABLE chats REPLICA IDENTITY FULL;
ALTER TABLE chat_participants REPLICA IDENTITY FULL;
ALTER TABLE messages REPLICA IDENTITY FULL;
ALTER TABLE profiles REPLICA IDENTITY FULL;

COMMIT;