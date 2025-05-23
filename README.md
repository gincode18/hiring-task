# Chat Application Database Schema

## Overview

This application uses Supabase as a backend with a real-time chat system. The database schema is designed to support a modern chat application with direct messages and group chats, user profiles, and real-time message delivery.

## Database Structure

The database consists of four main tables:

### 1. `profiles` Table

Stores user profile information linked to Supabase Auth.

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  phone_number TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_seen TIMESTAMPTZ
);
```

- `id`: Links directly to Supabase Auth user ID
- `email`: User's email address (unique)
- `full_name`: User's full name
- `avatar_url`: Optional URL to user's profile picture
- `phone_number`: Optional user phone number
- `created_at`: Timestamp when profile was created
- `last_seen`: Timestamp of user's last activity

### 2. `chats` Table

Stores information about chat conversations (direct messages or group chats).

```sql
CREATE TABLE chats (
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
```

- `id`: Unique identifier for the chat
- `name`: Optional name for group chats
- `type`: Type of chat (default: 'direct' for DMs)
- `created_at`: Timestamp when chat was created
- `created_by`: Reference to the user who created the chat
- Various flags to categorize special chat types:
  - `is_demo`: Demo/sample conversations
  - `is_internal`: Internal team chats
  - `is_signup`: Onboarding/signup conversations
  - `is_content`: Content-focused chats
- `last_message_at`: Timestamp of the most recent message (updated via trigger)

### 3. `chat_participants` Table

Links users to chats they're part of with participation details.

```sql
CREATE TABLE chat_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT now(),
  role TEXT DEFAULT 'member',
  is_muted BOOLEAN DEFAULT false,
  is_pinned BOOLEAN DEFAULT false,
  UNIQUE(chat_id, user_id)
);
```

- `id`: Unique identifier for the participation record
- `chat_id`: Reference to the chat
- `user_id`: Reference to the user profile
- `joined_at`: Timestamp when user joined the chat
- `role`: User's role in the chat (default: 'member')
- `is_muted`: Whether user has muted notifications for this chat
- `is_pinned`: Whether user has pinned this chat
- Unique constraint ensures a user can only be in a chat once

### 4. `messages` Table

Stores individual messages sent in chats.

```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  type TEXT DEFAULT 'text'
);
```

- `id`: Unique identifier for the message
- `chat_id`: Reference to the chat where message was sent
- `user_id`: Reference to the user who sent the message
- `content`: The actual message content
- `created_at`: Timestamp when message was sent
- `is_read`: Whether the message has been read by recipients
- `read_at`: Timestamp when message was read
- `type`: Message type (default: 'text', could be 'image', etc.)

## Security Model

The database implements Row Level Security (RLS) with specific policies:

### RLS Policies

1. **Profiles Table**:
   - Any authenticated user can read all profiles
   - Users can only update their own profile

2. **Chats Table**:
   - Users can create new chats
   - Users can see and update chats they created or participate in

3. **Chat Participants Table**:
   - Users can add participants to chats they've created
   - Users can see participants in chats they're part of or created
   - Users can update only their own participation settings

4. **Messages Table**:
   - Users can send messages only to chats they participate in
   - Users can read messages in chats they participate in or created
   - Users can update only their own messages

### Avoiding Infinite Recursion

To prevent infinite recursion in RLS policies (where a policy on `chat_participants` tries to check `chat_participants`), we use a security definer function:

```sql
CREATE OR REPLACE FUNCTION user_participates_in_chat(chat_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM chat_participants 
    WHERE chat_id = chat_uuid AND user_id = user_uuid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

This function runs with elevated privileges and can safely check participation without triggering RLS policies, preventing infinite loops.

## Real-time Features

The schema implements two key real-time features:

1. **Message Timestamp Updating**:
   - A trigger `update_chat_last_message` automatically updates the `last_message_at` field in the chats table whenever a new message is inserted
   - This enables sorting chats by most recent activity

2. **Supabase Realtime Configuration**:
   - All tables are configured for Supabase's real-time functionality
   - `REPLICA IDENTITY FULL` ensures complete data is available for real-time subscriptions
   - This enables instant updates when:
     - New messages are sent
     - Chats are created or updated
     - User profiles change
     - Users join or leave chats

## Database Relationships

![Database Relationships]

- One-to-One: `profiles` ↔ `auth.users` (Supabase Auth)
- One-to-Many: `profiles` → `chats` (creator relationship)
- One-to-Many: `profiles` → `messages` (sender relationship)
- One-to-Many: `chats` → `messages` (container relationship)
- Many-to-Many: `profiles` ↔ `chats` (through `chat_participants`)

## Why This Design?

1. **Separation of Concerns**: Each table has a specific purpose, making the schema clean and maintainable.

2. **Security First**: Row Level Security ensures users can only access data they're authorized to see.

3. **Real-time Ready**: Built from the ground up for real-time functionality, enabling instant messaging.

4. **Flexibility**: Supports both direct messages and group chats with the same structure.

5. **Extensibility**: The schema can easily be extended to support additional features like:
   - Message reactions
   - Read receipts
   - Typing indicators
   - File attachments
   - Message threading

6. **Efficient Queries**: The schema is designed to support common queries efficiently:
   - Get all chats for a user
   - Get all messages in a chat
   - Get all participants in a chat
   - Check if a user is in a specific chat
   - Get unread message counts

This schema provides a solid foundation for building a feature-rich chat application with Supabase while ensuring data security and real-time communication.
