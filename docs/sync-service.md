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

## 📊 Data Synchronization Methods

### 1. Message Synchronization

```typescript
async syncMessages(chatId: string, force = false): Promise<SyncResult>
```

**Flow:**
1. **Deduplication Check**: Prevent concurrent syncs of the same chat
2. **Incremental Sync**: Only fetch messages newer than last sync (unless forced)
3. **Data Storage**: Save messages to IndexedDB with profile information
4. **Status Update**: Record sync timestamp for future incremental syncs

**Key Features:**
- **Incremental Loading**: `gte("created_at", lastSync.lastSyncAt)`
- **Related Data**: Fetches messages with profile information in one query
- **Error Handling**: Comprehensive error catching and reporting

### 2. Chat Synchronization

```typescript
async syncChats(userId: string, force = false): Promise<SyncResult>
```

**Complex Data Relationships:**
```sql
-- Fetches chats with participants and their profiles
SELECT *,
  chat_participants(user_id, profiles(*))
FROM chats
WHERE id IN (user's chat IDs)
ORDER BY last_message_at DESC
```

**Multi-Step Process:**
1. Get user's chat IDs from `chat_participants` table
2. Fetch chats with nested participant and profile data
3. Store chats in IndexedDB
4. Store chat participants with composite keys
5. Store user profiles separately

### 3. Profile Synchronization

```typescript
async syncProfiles(force = false): Promise<SyncResult>
```

**Simpler Pattern:**
- Fetches all profiles (or incremental updates)
- Stores in IndexedDB for offline access
- Used for displaying user information in messages and chats

## 🚀 Hybrid Data Loading

### The Core Pattern

```typescript
async getMessages(chatId: string): Promise<Message[]> {
  try {
    // 1. Try IndexedDB first (instant response)
    const cachedMessages = await indexedDBService.getMessagesByChatId(chatId);
    
    if (cachedMessages.length > 0) {
      // 2. Return cached data immediately
      this.scheduleSyncMessages(chatId); // 3. Background sync
      return cachedMessages;
    }

    // 4. No cache? Fetch from Supabase directly
    const { data: remoteMessages } = await supabase
      .from("messages")
      .select("*, profiles(*)")
      .eq("chat_id", chatId);

    // 5. Cache for future use
    await indexedDBService.saveMessages(remoteMessages);
    return remoteMessages;

  } catch (error) {
    // 6. Fallback to direct Supabase fetch
    return await this.fallbackFetch(chatId);
  }
}
```

**Why This Pattern Works:**
- **Instant UX**: Users see data immediately from cache
- **Fresh Data**: Background sync ensures data is up-to-date
- **Resilient**: Multiple fallback strategies
- **Efficient**: Reduces server load and improves performance

## ⚡ Optimistic Updates

### Message Sending Flow

```typescript
async addMessageOptimistically(message: Omit<Message, 'id' | 'created_at'>): Promise<Message> {
  // 1. Create optimistic message with temporary ID
  const optimisticMessage: Message = {
    ...message,
    id: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    created_at: new Date().toISOString(),
  };

  // 2. Save to IndexedDB immediately (UI updates instantly)
  await indexedDBService.saveMessage(optimisticMessage);

  try {
    // 3. Send to Supabase in background
    const { data: savedMessage } = await supabase
      .from("messages")
      .insert([message])
      .select("*, profiles(*)")
      .single();

    // 4. Replace optimistic message with real one
    await indexedDBService.deleteMessage(optimisticMessage.id);
    await indexedDBService.saveMessage(savedMessage);
    return savedMessage;

  } catch (error) {
    // 5. Keep optimistic message, mark as failed
    return optimisticMessage;
  }
}
```

**Benefits:**
- **Instant Feedback**: UI updates immediately
- **Offline Support**: Works without internet connection
- **Error Recovery**: Failed messages can be retried
- **Consistent UX**: Same experience online/offline

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

**Why Debouncing?**
- **Efficiency**: Prevents excessive API calls
- **Battery Life**: Reduces mobile device battery drain
- **Server Load**: Reduces load on Supabase
- **User Experience**: Smooth performance without lag

## 🔍 Advanced Features

### 1. Fresh Data Fetching (Real-time Support)

```typescript
async getFreshMessages(chatId: string): Promise<Message[]> {
  // Always fetch from Supabase, ignore cache
  const { data: remoteMessages } = await supabase
    .from("messages")
    .select("*, profiles(*)")
    .eq("chat_id", chatId);

  // Update cache with fresh data
  await indexedDBService.saveMessages(remoteMessages);
  return remoteMessages;
}
```

**Use Case**: When real-time subscriptions detect new messages, this ensures we get the complete, fresh data.

### 2. Read Receipt Management

```typescript
async markMessagesAsRead(messageIds: string[]): Promise<void> {
  // 1. Optimistic update in IndexedDB
  await Promise.all(
    messageIds.map(async (messageId) => {
      const cachedMessage = await indexedDBService.getMessage(messageId);
      if (cachedMessage) {
        const updatedMessage = {
          ...cachedMessage,
          is_read: true,
          read_at: new Date().toISOString()
        };
        await indexedDBService.saveMessage(updatedMessage);
      }
    })
  );

  // 2. Update in Supabase
  await supabase
    .from("messages")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .in("id", messageIds);
}
```

**Pattern**: Optimistic local update + background server sync

### 3. Full Sync Operation

```typescript
async fullSync(userId: string): Promise<{
  messages: SyncResult;
  chats: SyncResult;
  profiles: SyncResult;
}> {
  const [messagesResult, chatsResult, profilesResult] = await Promise.allSettled([
    this.syncMessages('', true), // Force sync all messages
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

**Use Cases:**
- Initial app load
- User login
- Manual refresh
- Recovery from errors

## 🛡️ Error Handling & Resilience

### Multi-Layer Fallback Strategy

```typescript
async getMessages(chatId: string): Promise<Message[]> {
  try {
    // Layer 1: Try IndexedDB
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
      // Layer 4: Return empty array (graceful degradation)
      console.error("All fetch methods failed");
      return [];
    }
  }
}
```

### Sync Conflict Prevention

```typescript
if (this.syncInProgress.has(syncKey) && !force) {
  return { success: false, error: "Sync already in progress", synced: 0 };
}

this.syncInProgress.add(syncKey);
try {
  // Sync logic here
} finally {
  this.syncInProgress.delete(syncKey);
}
```

## 📈 Performance Optimizations

### 1. Incremental Synchronization

```typescript
// Only fetch data newer than last sync
if (!force && lastSync?.lastSyncAt) {
  query = query.gte("created_at", lastSync.lastSyncAt);
}
```

**Benefits:**
- Reduces data transfer
- Faster sync times
- Lower server load
- Better mobile experience

### 2. Batch Operations

```typescript
// Store multiple messages in one IndexedDB transaction
await indexedDBService.saveMessages(remoteMessages);

// Store related data efficiently
for (const chat of remoteChats) {
  if (chat.chat_participants) {
    for (const participant of chat.chat_participants) {
      await indexedDBService.saveChatParticipant(participant);
      if (participant.profiles) {
        await indexedDBService.saveProfile(participant.profiles);
      }
    }
  }
}
```

### 3. Smart Caching Strategy

```typescript
// Cache hit: Return immediately + background sync
if (cachedMessages.length > 0) {
  this.scheduleSyncMessages(chatId); // Non-blocking background sync
  return cachedMessages;
}
```

## 🔧 Integration Patterns

### With React Hooks

```typescript
// In useChatData hook
const messages = await syncService.getMessages(chatId);
setMessages(messages);

// Background sync doesn't block UI
syncService.scheduleSyncMessages(chatId);
```

### With Real-time Subscriptions

```typescript
// When real-time event received
supabase.channel(`messages:${chatId}`)
  .on("postgres_changes", async (payload) => {
    // Get fresh data to ensure consistency
    const freshMessages = await syncService.getFreshMessages(chatId);
    setMessages(freshMessages);
  });
```

### With Offline Detection

```typescript
window.addEventListener('online', async () => {
  // Sync when connection restored
  await syncService.fullSync(userId);
});
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