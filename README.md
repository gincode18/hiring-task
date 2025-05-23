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

## Real-time Chat System with Supabase

This application achieves **instant message delivery** and **live UI updates** using Supabase's real-time infrastructure. Here's how the complete real-time system works:

### 🏗️ **Database-Level Real-time Configuration**

#### 1. **Supabase Realtime Setup** (in migrations)
```sql
-- Enable realtime for all tables
ALTER PUBLICATION supabase_realtime ADD TABLE chats, chat_participants, messages, profiles;

-- Configure full row replication for complete data access
ALTER TABLE chats REPLICA IDENTITY FULL;
ALTER TABLE chat_participants REPLICA IDENTITY FULL;
ALTER TABLE messages REPLICA IDENTITY FULL;
ALTER TABLE profiles REPLICA IDENTITY FULL;
```

#### 2. **Automatic Timestamp Updates** (Database Triggers)
```sql
-- Trigger that updates chat's last_message_at when new message is inserted
CREATE TRIGGER update_chat_last_message
AFTER INSERT ON messages
FOR EACH ROW
EXECUTE FUNCTION update_last_message_timestamp();
```

### 🚀 **UI-Level Real-time Implementation**

#### 1. **Chat Messages Real-time** (`components/chat/chat-messages.tsx`)

**How messages appear instantly when received:**

```typescript
// Subscribe to new messages for specific chat
const subscription = supabase
  .channel(`messages:${chatId}`)
  .on(
    "postgres_changes",
    {
      event: "INSERT",           // Listen for new messages
      schema: "public",
      table: "messages", 
      filter: `chat_id=eq.${chatId}`,  // Only this chat's messages
    },
    async (payload) => {
      // When a new message is inserted in database:
      
      // 1. Fetch complete message with user profile data
      const { data } = await supabase
        .from("messages")
        .select("*, profiles(*)")
        .eq("id", payload.new.id)
        .single();

      // 2. Instantly add to UI state (no page refresh needed!)
      if (data) {
        setMessages(current => [...current, data]);
      }
    }
  )
  .subscribe();
```

**What happens when you receive a message:**
1. ✅ **Someone sends a message** → Database INSERT occurs
2. ✅ **Supabase detects change** → Triggers real-time event
3. ✅ **Your browser receives event** → Subscription callback fires
4. ✅ **UI updates instantly** → New message appears immediately
5. ✅ **Auto-scroll to bottom** → View scrolls to show new message
6. ✅ **Mark as read** → Updates read status automatically

#### 2. **Chat Sidebar Real-time** (`components/chat/chat-sidebar.tsx`)

**How chat list updates when new chats are created or messages are sent:**

```typescript
// Subscribe to chat changes (new chats, updates)
const chatSubscription = supabase
  .channel("chats-channel")
  .on("postgres_changes", {
    event: "*",                    // All events (INSERT, UPDATE, DELETE)
    schema: "public", 
    table: "chats"
  }, () => {
    fetchChats();                 // Refresh entire chat list
  })
  .subscribe();

// Subscribe to message changes (affects chat ordering)
const messageSubscription = supabase
  .channel("messages-channel") 
  .on("postgres_changes", {
    event: "*",
    schema: "public",
    table: "messages"
  }, () => {
    fetchChats();                 // Refresh to update last_message_at ordering
  })
  .subscribe();
```

**What happens when activity occurs:**
1. ✅ **New message sent** → Triggers chat list refresh
2. ✅ **Chat ordering updates** → Most recent chats appear at top  
3. ✅ **New chat created** → Appears in sidebar immediately
4. ✅ **User joins chat** → Chat appears in their sidebar instantly

### 🔄 **Complete Real-time Data Flow**

Here's the **end-to-end flow** when User A sends a message to User B:

```
1. 📱 User A types message & hits send
   └── ChatInput component calls supabase.from("messages").insert()

2. 🗄️  Database receives INSERT
   └── New row added to messages table
   └── Trigger updates chats.last_message_at
   └── Supabase detects postgres_changes

3. 📡 Supabase broadcasts real-time events
   ├── Event sent to all subscribed clients
   └── Includes full row data (REPLICA IDENTITY FULL)

4. 📱 User B's browser receives events
   ├── ChatMessages subscription → New message appears
   ├── ChatSidebar subscription → Chat moves to top  
   └── Auto-scroll → Scrolls to show new message

5. ⚡ UI updates instantly (< 100ms typically)
   ├── No polling required
   ├── No page refresh needed
   └── True real-time experience
```

### 🎯 **Real-time Features In Action**

#### **Instant Message Delivery**
```typescript
// When you send a message
await supabase.from("messages").insert({
  chat_id: chatId,
  user_id: user.id, 
  content: messageText
});
// → Other users see it immediately via subscription
```

#### **Live Chat List Updates**  
- ✅ **New chats** appear instantly when created
- ✅ **Message previews** update in real-time
- ✅ **Chat ordering** changes as new messages arrive
- ✅ **Unread indicators** update automatically

#### **Read Receipt System**
```typescript
// Auto-mark messages as read when viewed
useEffect(() => {
  const unreadMessages = messages.filter(m => 
    !m.is_read && m.user_id !== user.id
  );
  
  if (unreadMessages.length > 0) {
    await supabase.from("messages")
      .update({ is_read: true, read_at: new Date() })
      .in("id", unreadMessages.map(m => m.id));
  }
}, [messages]);
```

### 🔧 **Technical Implementation Details**

#### **Why This Approach Works So Well:**

1. **🌐 WebSocket Connection**: Supabase maintains persistent WebSocket connections for each client
2. **🎯 Selective Subscriptions**: Only listen to relevant data changes (specific chats, tables)
3. **🔄 Automatic Reconnection**: Handles network interruptions gracefully
4. **🔐 Security Integration**: Real-time respects RLS policies automatically
5. **📊 Full Row Data**: `REPLICA IDENTITY FULL` provides complete change information

#### **Performance Optimizations:**

- **Targeted Filters**: `filter: "chat_id=eq.${chatId}"` ensures only relevant updates
- **Efficient State Updates**: Add new messages to existing array instead of full refetch
- **Smart Refreshing**: Sidebar refreshes list, but messages append individually
- **Cleanup**: Proper subscription cleanup prevents memory leaks

#### **Error Handling & Reliability:**

- **Connection Management**: Automatic reconnection on network issues
- **Subscription Cleanup**: `subscription.unsubscribe()` in component cleanup
- **Fallback Polling**: Could add polling fallback if real-time fails
- **Error Boundaries**: Graceful degradation if real-time features fail

### 🚀 **Benefits of This Real-time Architecture**

1. **⚡ Instant Updates**: Messages appear immediately (< 100ms)
2. **🔋 Battery Efficient**: No continuous polling needed
3. **📱 Mobile Friendly**: Works seamlessly on mobile devices
4. **🌐 Scalable**: Supabase handles connection management
5. **🔐 Secure**: Automatic integration with authentication & RLS
6. **🐛 Easy Debugging**: Clear event logs and subscription states

This real-time system creates a **WhatsApp-like experience** where messages, chat lists, and user interactions update instantly across all connected devices! 🎉

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
