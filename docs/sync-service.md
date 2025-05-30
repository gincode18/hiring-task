# Sync Service Documentation

## 🎯 Overview

The `SyncService` is the core orchestrator of the offline-first architecture in the chat application. It manages data synchronization between the local IndexedDB cache and the remote Supabase database, ensuring users have instant access to data while maintaining consistency across devices.

## 🏗️ Architecture Pattern

The sync service implements a **hybrid data loading strategy**:

1. **Local-First Loading**: Always try IndexedDB first for instant response
2. **Background Synchronization**: Fetch fresh data from Supabase in the background
3. **Optimistic Updates**: Update UI immediately, sync to server later
4. **Conflict Resolution**: Handle sync conflicts gracefully

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React UI      │    │   Sync Service  │    │   Supabase      │
│                 │    │                 │    │                 │
│ 1. Request Data │───▶│ 2. Check Cache  │    │                 │
│                 │    │                 │    │                 │
│ 3. Return Cache │◀───│ 4. Start Sync   │───▶│ 5. Fetch Fresh  │
│                 │    │                 │    │                 │
│ 7. Update UI    │◀───│ 6. Update Cache │◀───│                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🔧 Core Components

### 1. Class Structure

```typescript
class SyncService {
  private syncInProgress: Set<string> = new Set();     // Prevent duplicate syncs
  private syncTimeouts: Map<string, NodeJS.Timeout> = new Map(); // Debounced syncs
}
```

**Key Design Decisions:**
- **Singleton Pattern**: Single instance manages all sync operations
- **Sync Deduplication**: Prevents multiple syncs of the same data
- **Debounced Operations**: Reduces unnecessary API calls

### 2. Sync Result Interface

```typescript
interface SyncResult {
  success: boolean;
  error?: string;
  synced: number;  // Number of records synchronized
}
```

This standardized response format makes it easy to handle sync results consistently across the application.

## 📊 Complete Function Analysis

### 1. Message Synchronization - `syncMessages()`

```typescript
async syncMessages(chatId: string, force = false): Promise<SyncResult> {
  const syncKey = `messages-${chatId}`;
  
  // Step 1: Prevent duplicate syncs
  if (this.syncInProgress.has(syncKey) && !force) {
    return { success: false, error: "Sync already in progress", synced: 0 };
  }

  this.syncInProgress.add(syncKey);

  try {
    // Step 2: Get last sync timestamp for incremental sync
    const lastSync = await indexedDBService.getSyncStatus('messages');
    
    // Step 3: Build Supabase query
    let query = supabase
      .from("messages")
      .select("*, profiles(*)")  // Join with profiles table
      .eq("chat_id", chatId)     // Filter by specific chat
      .order("created_at", { ascending: true }); // Chronological order

    // Step 4: Incremental sync - only fetch new messages
    if (!force && lastSync?.lastSyncAt) {
      query = query.gte("created_at", lastSync.lastSyncAt);
    }

    // Step 5: Execute query
    const { data: remoteMessages, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch messages: ${error.message}`);
    }

    // Step 6: Store in IndexedDB if we have data
    if (remoteMessages && remoteMessages.length > 0) {
      await indexedDBService.saveMessages(remoteMessages as Message[]);
      await indexedDBService.updateSyncStatus('messages');
    }

    return { 
      success: true, 
      synced: remoteMessages?.length || 0 
    };

  } catch (error) {
    console.error("Message sync error:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error",
      synced: 0 
    };
  } finally {
    // Step 7: Always cleanup sync tracking
    this.syncInProgress.delete(syncKey);
  }
}
```

**Query Breakdown:**
```sql
-- What this Supabase query does:
SELECT messages.*, profiles.*
FROM messages
LEFT JOIN profiles ON messages.user_id = profiles.id
WHERE messages.chat_id = 'specific-chat-id'
  AND messages.created_at >= 'last-sync-timestamp'  -- Only if incremental
ORDER BY messages.created_at ASC;
```

**Function Flow:**
1. **Deduplication Check**: Prevents multiple syncs of same chat
2. **Sync Status**: Gets last sync time for incremental loading
3. **Query Building**: Constructs Supabase query with joins
4. **Incremental Logic**: Only fetches new messages since last sync
5. **Data Storage**: Saves messages with profile data to IndexedDB
6. **Status Update**: Records sync completion time
7. **Cleanup**: Removes sync lock regardless of success/failure

### 2. Chat Synchronization - `syncChats()`

```typescript
async syncChats(userId: string, force = false): Promise<SyncResult> {
  const syncKey = `chats-${userId}`;
  
  if (this.syncInProgress.has(syncKey) && !force) {
    return { success: false, error: "Sync already in progress", synced: 0 };
  }

  this.syncInProgress.add(syncKey);

  try {
    // Step 1: Get last sync status
    const lastSync = await indexedDBService.getSyncStatus('chats');
    
    // Step 2: Get user's chat IDs first
    const userChatIds = await this.getUserChatIds(userId);
    
    // Step 3: Build complex query with nested relationships
    let query = supabase
      .from("chats")
      .select(`
        *,
        chat_participants(user_id, profiles(*))
      `)
      .in("id", userChatIds)  // Only chats user participates in
      .order("last_message_at", { ascending: false }); // Most recent first

    // Step 4: Incremental sync for chats
    if (!force && lastSync?.lastSyncAt) {
      query = query.gte("last_message_at", lastSync.lastSyncAt);
    }

    const { data: remoteChats, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch chats: ${error.message}`);
    }

    if (remoteChats && remoteChats.length > 0) {
      // Step 5: Store chats
      await indexedDBService.saveChats(remoteChats as Chat[]);

      // Step 6: Store related data (participants and profiles)
      for (const chat of remoteChats) {
        if (chat.chat_participants) {
          for (const participant of chat.chat_participants) {
            // Add chat_id for IndexedDB composite key
            const participantWithChatId = {
              ...participant,
              chat_id: chat.id
            };
            await indexedDBService.saveChatParticipant(participantWithChatId);
            
            // Store user profiles separately
            if (participant.profiles) {
              await indexedDBService.saveProfile(participant.profiles);
            }
          }
        }
      }
      
      await indexedDBService.updateSyncStatus('chats');
    }

    return { 
      success: true, 
      synced: remoteChats?.length || 0 
    };

  } catch (error) {
    console.error("Chat sync error:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error",
      synced: 0 
    };
  } finally {
    this.syncInProgress.delete(syncKey);
  }
}
```

**Complex Query Breakdown:**
```sql
-- Step 1: Get user's chat IDs
SELECT chat_id 
FROM chat_participants 
WHERE user_id = 'user-id';

-- Step 2: Get chats with nested data
SELECT 
  chats.*,
  chat_participants.user_id,
  profiles.*
FROM chats
LEFT JOIN chat_participants ON chats.id = chat_participants.chat_id
LEFT JOIN profiles ON chat_participants.user_id = profiles.id
WHERE chats.id IN (user's chat IDs)
  AND chats.last_message_at >= 'last-sync-timestamp'  -- Only if incremental
ORDER BY chats.last_message_at DESC;
```

**Function Flow:**
1. **User Chat Discovery**: First finds all chats user participates in
2. **Complex Query**: Fetches chats with participants and their profiles
3. **Nested Data Handling**: Processes complex nested relationships
4. **Multi-Table Storage**: Stores chats, participants, and profiles separately
5. **Composite Keys**: Handles IndexedDB composite key requirements

### 3. Helper Function - `getUserChatIds()`

```typescript
private async getUserChatIds(userId: string): Promise<string[]> {
  const { data: chatParticipants, error } = await supabase
    .from("chat_participants")
    .select("chat_id")
    .eq("user_id", userId);

  if (error) {
    console.error("Error fetching user chat IDs:", error);
    return [];
  }

  return chatParticipants.map(cp => cp.chat_id);
}
```

**Query Purpose:**
```sql
-- Find all chats where user is a participant
SELECT chat_id 
FROM chat_participants 
WHERE user_id = 'specific-user-id';
```

**Why This Helper Exists:**
- **Security**: Only fetch chats user has access to
- **Performance**: Reduces data transfer by filtering early
- **Reusability**: Used by multiple functions

### 4. Hybrid Data Loading - `getMessages()`

```typescript
async getMessages(chatId: string): Promise<Message[]> {
  try {
    // Step 1: Try IndexedDB first (instant response)
    const cachedMessages = await indexedDBService.getMessagesByChatId(chatId);
    
    if (cachedMessages.length > 0) {
      // Step 2: Return cached data immediately
      this.scheduleSyncMessages(chatId); // Step 3: Background sync
      return cachedMessages;
    }

    // Step 4: No cache? Fetch from Supabase directly
    const { data: remoteMessages, error } = await supabase
      .from("messages")
      .select("*, profiles(*)")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch messages: ${error.message}`);
    }

    const messages = (remoteMessages as Message[]) || [];
    
    // Step 5: Cache for future use
    if (messages.length > 0) {
      try {
        await indexedDBService.saveMessages(messages);
        await indexedDBService.updateSyncStatus('messages');
      } catch (cacheError) {
        console.warn("Failed to cache messages:", cacheError);
        // Continue without caching
      }
    }

    return messages;

  } catch (error) {
    console.error("Error getting messages:", error);
    
    // Step 6: Fallback strategy
    try {
      const { data: remoteMessages, error: supabaseError } = await supabase
        .from("messages")
        .select("*, profiles(*)")
        .eq("chat_id", chatId)
        .order("created_at", { ascending: true });

      if (supabaseError) {
        throw new Error(`Failed to fetch messages: ${supabaseError.message}`);
      }

      return (remoteMessages as Message[]) || [];
    } catch (fallbackError) {
      console.error("Fallback fetch also failed:", fallbackError);
      return [];
    }
  }
}
```

**Multi-Layer Strategy:**
1. **Layer 1**: IndexedDB cache (instant, ~10ms)
2. **Layer 2**: Background sync (non-blocking)
3. **Layer 3**: Direct Supabase fetch (if no cache)
4. **Layer 4**: Fallback Supabase fetch (if errors)
5. **Layer 5**: Empty array (graceful degradation)

### 5. Optimistic Updates - `addMessageOptimistically()`

```typescript
async addMessageOptimistically(message: Omit<Message, 'id' | 'created_at'>): Promise<Message> {
  // Step 1: Create optimistic message with temporary ID
  const optimisticMessage: Message = {
    ...message,
    id: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    created_at: new Date().toISOString(),
  };

  try {
    // Step 2: Save to IndexedDB immediately (UI updates instantly)
    await indexedDBService.saveMessage(optimisticMessage);

    // Step 3: Send to Supabase in background
    const { data: savedMessage, error } = await supabase
      .from("messages")
      .insert([{
        chat_id: message.chat_id,
        user_id: message.user_id,
        content: message.content,
        type: message.type || 'text',
      }])
      .select("*, profiles(*)")
      .single();

    if (error) {
      throw error;
    }

    // Step 4: Replace optimistic message with real one
    if (savedMessage) {
      await indexedDBService.deleteMessage(optimisticMessage.id);
      await indexedDBService.saveMessage(savedMessage as Message);
      return savedMessage as Message;
    }

    return optimisticMessage;

  } catch (error) {
    console.error("Error adding message:", error);
    // Step 5: Keep optimistic message, mark as failed
    return optimisticMessage;
  }
}
```

**Optimistic Update Flow:**
1. **Immediate UI**: Create temp message, show in UI instantly
2. **Local Storage**: Save to IndexedDB for persistence
3. **Server Sync**: Send to Supabase in background
4. **ID Replacement**: Replace temp ID with real server ID
5. **Error Handling**: Keep optimistic message if server fails

**Insert Query:**
```sql
-- Insert new message and return with profile data
INSERT INTO messages (chat_id, user_id, content, type)
VALUES ('chat-id', 'user-id', 'message content', 'text')
RETURNING messages.*, profiles.*;
```

### 6. Fresh Data Fetching - `getFreshMessages()`

```typescript
async getFreshMessages(chatId: string): Promise<Message[]> {
  try {
    console.log("Fetching fresh messages from Supabase for chatId:", chatId);
    
    // Always fetch from Supabase, ignore cache
    const { data: remoteMessages, error } = await supabase
      .from("messages")
      .select("*, profiles(*)")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch fresh messages: ${error.message}`);
    }

    const messages = (remoteMessages as Message[]) || [];
    console.log("Got fresh messages:", messages.length);
    
    // Update IndexedDB cache with fresh data
    if (messages.length > 0) {
      try {
        await indexedDBService.saveMessages(messages);
        await indexedDBService.updateSyncStatus('messages');
        console.log("Updated cache with fresh messages");
      } catch (cacheError) {
        console.warn("Failed to update cache with fresh messages:", cacheError);
      }
    }

    return messages;

  } catch (error) {
    console.error("Error getting fresh messages:", error);
    // Fallback to regular cached method
    return this.getMessages(chatId);
  }
}
```

**Use Case**: Real-time events trigger this to ensure absolute freshness
**Query**: Same as `getMessages()` but bypasses cache entirely

### 7. Read Receipt Management - `markMessagesAsRead()`

```typescript
async markMessagesAsRead(messageIds: string[]): Promise<void> {
  if (messageIds.length === 0) return;

  try {
    console.log("Marking messages as read:", messageIds);
    
    // Step 1: Optimistic update in IndexedDB
    const readAt = new Date().toISOString();
    await Promise.all(
      messageIds.map(async (messageId) => {
        try {
          const cachedMessage = await indexedDBService.getMessage(messageId);
          if (cachedMessage) {
            const updatedMessage = {
              ...cachedMessage,
              is_read: true,
              read_at: readAt
            };
            await indexedDBService.saveMessage(updatedMessage);
          }
        } catch (error) {
          console.warn("Failed to update message in cache:", messageId, error);
        }
      })
    );

    // Step 2: Update in Supabase
    const { error } = await supabase
      .from("messages")
      .update({ is_read: true, read_at: readAt })
      .in("id", messageIds);

    if (error) {
      console.error("Error marking messages as read in Supabase:", error);
      throw error;
    }

    console.log("Successfully marked messages as read");

  } catch (error) {
    console.error("Error in markMessagesAsRead:", error);
    throw error;
  }
}
```

**Update Query:**
```sql
-- Batch update multiple messages
UPDATE messages 
SET is_read = true, read_at = '2024-01-01T12:00:00Z'
WHERE id IN ('msg-1', 'msg-2', 'msg-3');
```

**Pattern**: Optimistic local update + background server sync

### 8. Full Sync Operation - `fullSync()`

```typescript
async fullSync(userId: string): Promise<{
  messages: SyncResult;
  chats: SyncResult;
  profiles: SyncResult;
}> {
  const [messagesResult, chatsResult, profilesResult] = await Promise.allSettled([
    this.syncMessages('', true), // Empty chatId = all messages, force = true
    this.syncChats(userId, true),
    this.syncProfiles(true),
  ]);

  return {
    messages: messagesResult.status === 'fulfilled' ? messagesResult.value : { success: false, error: 'Failed', synced: 0 },
    chats: chatsResult.status === 'fulfilled' ? chatsResult.value : { success: false, error: 'Failed', synced: 0 },
    profiles: profilesResult.status === 'fulfilled' ? profilesResult.value : { success: false, error: 'Failed', synced: 0 },
  };
}
```

**Parallel Execution**: Uses `Promise.allSettled()` to run all syncs simultaneously
**Force Mode**: `force = true` bypasses incremental sync, fetches everything

## 🔄 Background Synchronization

### Debounced Sync Scheduling

```typescript
private scheduleSyncMessages(chatId: string, delay = 2000): void {
  const key = `messages-${chatId}`;
  
  // Clear existing timeout (debouncing)
  if (this.syncTimeouts.has(key)) {
    clearTimeout(this.syncTimeouts.get(key)!);
  }

  // Schedule new sync
  const timeout = setTimeout(() => {
    this.syncMessages(chatId);
    this.syncTimeouts.delete(key);
  }, delay);

  this.syncTimeouts.set(key, timeout);
}
```

**Debouncing Logic:**
1. **Cancel Previous**: Clear any existing timeout for this chat
2. **Schedule New**: Set new timeout with delay
3. **Execute**: Run sync after delay
4. **Cleanup**: Remove timeout reference

**Why 2-second delay?**
- **User Experience**: Don't sync on every keystroke
- **Performance**: Reduce API calls
- **Battery**: Save mobile device battery

## 🔍 Advanced Query Patterns

### 1. Incremental Sync Query

```typescript
// Base query
let query = supabase
  .from("messages")
  .select("*, profiles(*)")
  .eq("chat_id", chatId)
  .order("created_at", { ascending: true });

// Add incremental filter
if (!force && lastSync?.lastSyncAt) {
  query = query.gte("created_at", lastSync.lastSyncAt);
}
```

**SQL Equivalent:**
```sql
-- Without incremental (full sync)
SELECT messages.*, profiles.*
FROM messages
LEFT JOIN profiles ON messages.user_id = profiles.id
WHERE messages.chat_id = 'chat-123'
ORDER BY messages.created_at ASC;

-- With incremental (only new messages)
SELECT messages.*, profiles.*
FROM messages
LEFT JOIN profiles ON messages.user_id = profiles.id
WHERE messages.chat_id = 'chat-123'
  AND messages.created_at >= '2024-01-01T10:00:00Z'
ORDER BY messages.created_at ASC;
```

### 2. Complex Nested Query (Chats)

```typescript
const query = supabase
  .from("chats")
  .select(`
    *,
    chat_participants(user_id, profiles(*))
  `)
  .in("id", userChatIds)
  .order("last_message_at", { ascending: false });
```

**SQL Equivalent:**
```sql
-- Complex nested query with multiple joins
SELECT 
  chats.*,
  json_agg(
    json_build_object(
      'user_id', chat_participants.user_id,
      'profiles', json_build_object(
        'id', profiles.id,
        'email', profiles.email,
        'full_name', profiles.full_name,
        'avatar_url', profiles.avatar_url
      )
    )
  ) as chat_participants
FROM chats
LEFT JOIN chat_participants ON chats.id = chat_participants.chat_id
LEFT JOIN profiles ON chat_participants.user_id = profiles.id
WHERE chats.id IN ('chat-1', 'chat-2', 'chat-3')
GROUP BY chats.id
ORDER BY chats.last_message_at DESC;
```

### 3. Batch Update Query

```typescript
const { error } = await supabase
  .from("messages")
  .update({ is_read: true, read_at: readAt })
  .in("id", messageIds);
```

**SQL Equivalent:**
```sql
-- Batch update multiple records
UPDATE messages 
SET 
  is_read = true, 
  read_at = '2024-01-01T12:00:00Z'
WHERE id IN ('msg-1', 'msg-2', 'msg-3', 'msg-4');
```

## 🛡️ Error Handling Strategies

### 1. Multi-Layer Fallback

```typescript
async getMessages(chatId: string): Promise<Message[]> {
  try {
    // Layer 1: IndexedDB cache
    const cached = await indexedDBService.getMessagesByChatId(chatId);
    if (cached.length > 0) return cached;

    // Layer 2: Direct Supabase fetch
    const { data } = await supabase.from("messages")...;
    return data || [];

  } catch (error) {
    try {
      // Layer 3: Fallback Supabase fetch
      const { data } = await supabase.from("messages")...;
      return data || [];
    } catch (fallbackError) {
      // Layer 4: Graceful degradation
      return [];
    }
  }
}
```

### 2. Sync Conflict Prevention

```typescript
// Prevent duplicate syncs
if (this.syncInProgress.has(syncKey) && !force) {
  return { success: false, error: "Sync already in progress", synced: 0 };
}

this.syncInProgress.add(syncKey);
try {
  // Sync logic
} finally {
  // Always cleanup, even if error occurs
  this.syncInProgress.delete(syncKey);
}
```

## 📈 Performance Optimizations

### 1. Query Optimization

```typescript
// Efficient: Only fetch needed fields with joins
.select("*, profiles(*)")

// Efficient: Use indexes for filtering
.eq("chat_id", chatId)
.gte("created_at", lastSync.lastSyncAt)

// Efficient: Proper ordering
.order("created_at", { ascending: true })
```

### 2. Batch Operations

```typescript
// Efficient: Batch save multiple messages
await indexedDBService.saveMessages(remoteMessages);

// Efficient: Parallel async operations
await Promise.all(messageIds.map(async (messageId) => {
  // Update each message
}));
```

### 3. Smart Caching

```typescript
// Return cache immediately, sync in background
if (cachedMessages.length > 0) {
  this.scheduleSyncMessages(chatId); // Non-blocking
  return cachedMessages;
}
```

## 🎯 Key Design Principles

### 1. **Local-First**
- Always try local data first
- Provide instant user experience
- Sync in background

### 2. **Optimistic Updates**
- Update UI immediately
- Handle failures gracefully
- Provide user feedback

### 3. **Resilient Architecture**
- Multiple fallback strategies
- Graceful error handling
- Never leave users with broken state

### 4. **Performance Focused**
- Debounced operations
- Incremental syncing
- Efficient caching

### 5. **Developer Experience**
- Consistent API patterns
- Comprehensive error reporting
- Easy debugging and monitoring

## 🚀 Usage Examples

### Basic Message Loading
```typescript
// Get messages (cache-first, background sync)
const messages = await syncService.getMessages(chatId);
```

### Sending Messages
```typescript
// Optimistic send
const message = await syncService.addMessageOptimistically({
  chat_id: chatId,
  user_id: userId,
  content: "Hello world!",
  type: "text"
});
```

### Force Refresh
```typescript
// Get absolutely fresh data
const freshMessages = await syncService.getFreshMessages(chatId);
```

### Full Sync
```typescript
// Sync everything
const results = await syncService.fullSync(userId);
console.log(`Synced ${results.messages.synced} messages`);
```

This sync service is the backbone of the offline-first architecture, providing a seamless experience whether users are online or offline, while ensuring data consistency and optimal performance. 