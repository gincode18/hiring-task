# IndexedDB Offline-First Implementation Guide

## Overview

This project implements a sophisticated **offline-first** chat application using IndexedDB for local data storage and Supabase for server-side persistence. The architecture ensures that users can continue chatting even when offline, with automatic synchronization when connectivity is restored.

## 🔰 IndexedDB Fundamentals for Beginners

### What is IndexedDB?

IndexedDB is a **client-side database** built into web browsers that allows you to store large amounts of structured data locally. Unlike localStorage (which only stores strings), IndexedDB can store:
- Objects
- Arrays
- Files
- Blobs
- Complex data structures

### Key IndexedDB Concepts

#### 1. **Database**
- A container that holds all your data
- Has a name and version number
- Can contain multiple "object stores"

#### 2. **Object Store**
- Similar to a "table" in SQL databases
- Stores JavaScript objects
- Each object store has a primary key

#### 3. **Index**
- Allows you to search/query data by fields other than the primary key
- Makes data retrieval faster

#### 4. **Transaction**
- A group of operations that either all succeed or all fail
- Ensures data consistency
- Can be "readonly" or "readwrite"

#### 5. **Cursor**
- Used to iterate through multiple records
- Like a pointer that moves through data

### Why IndexedDB for Chat Apps?

✅ **Large Storage Capacity** - Can store thousands of messages
✅ **Fast Queries** - Indexed searches are very fast
✅ **Offline Support** - Works without internet connection
✅ **Structured Data** - Can store complex message objects
✅ **Asynchronous** - Won't block the UI

## 📁 Complete IndexedDB Implementation Breakdown

### 1. Type Definitions and Setup

```typescript
// Import database types from Supabase schema
import { Database } from "./database.types";

// Create enhanced types that include related data
type Message = Database["public"]["Tables"]["messages"]["Row"] & {
  profiles?: Database["public"]["Tables"]["profiles"]["Row"];
};

type Chat = Database["public"]["Tables"]["chats"]["Row"] & {
  chat_participants?: Array<{
    user_id: string;
    profiles: Database["public"]["Tables"]["profiles"]["Row"];
  }>;
  messages?: Array<Database["public"]["Tables"]["messages"]["Row"]>;
};

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
```

**What's happening here:**
- We're extending the basic database types to include related data
- `Message` can include the sender's profile information
- `Chat` can include participants and their profiles
- This makes the data more useful when retrieved from IndexedDB

### 2. Database Configuration

```typescript
// IndexedDB schema version - increment when structure changes
const DB_VERSION = 2;
const DB_NAME = "ChatAppDB";

// Object store names - like table names in SQL
const STORES = {
  MESSAGES: "messages",
  CHATS: "chats", 
  PROFILES: "profiles",
  CHAT_PARTICIPANTS: "chat_participants",
  SYNC_STATUS: "sync_status",
} as const;
```

**Key Points:**
- **DB_VERSION**: When you change the database structure, increment this number
- **DB_NAME**: The name of your IndexedDB database
- **STORES**: Constants for object store names (prevents typos)

### 3. IndexedDB Service Class Structure

```typescript
class IndexedDBService {
  private db: IDBDatabase | null = null;           // The database connection
  private dbPromise: Promise<IDBDatabase> | null = null;  // Promise for async initialization
```

**Why these properties:**
- `db`: Holds the actual database connection once established
- `dbPromise`: Ensures we only initialize the database once, even if multiple operations start simultaneously

### 4. Database Initialization (The Most Complex Part)

```typescript
private async initDB(): Promise<IDBDatabase> {
  // Return existing connection if available
  if (this.db) return this.db;
  if (this.dbPromise) return this.dbPromise;

  // Check if IndexedDB is supported
  if (typeof window === 'undefined' || !window.indexedDB) {
    throw new Error('IndexedDB is not available in this environment');
  }

  this.dbPromise = new Promise((resolve, reject) => {
    // Open database with name and version
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      this.db = request.result;
      resolve(request.result);
    };

    // This runs when database is created or version is upgraded
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const oldVersion = (event as IDBVersionChangeEvent).oldVersion;

      // Create object stores and indexes...
    };
  });

  return this.dbPromise;
}
```

**Step-by-step breakdown:**

1. **Check existing connection**: If database is already open, return it
2. **Browser compatibility**: Ensure IndexedDB is available
3. **Open database**: `indexedDB.open()` returns a request object
4. **Handle events**:
   - `onsuccess`: Database opened successfully
   - `onerror`: Something went wrong
   - `onupgradeneeded`: Database needs to be created or updated

### 5. Creating Object Stores and Indexes

```typescript
request.onupgradeneeded = (event) => {
  const db = (event.target as IDBOpenDBRequest).result;
  const oldVersion = (event as IDBVersionChangeEvent).oldVersion;

  // Messages store
  if (!db.objectStoreNames.contains(STORES.MESSAGES)) {
    const messagesStore = db.createObjectStore(STORES.MESSAGES, { keyPath: "id" });
    messagesStore.createIndex("chat_id", "chat_id");      // Find messages by chat
    messagesStore.createIndex("user_id", "user_id");      // Find messages by user
    messagesStore.createIndex("created_at", "created_at"); // Sort by time
    messagesStore.createIndex("is_read", "is_read");       // Find unread messages
  }

  // Chats store
  if (!db.objectStoreNames.contains(STORES.CHATS)) {
    const chatsStore = db.createObjectStore(STORES.CHATS, { keyPath: "id" });
    chatsStore.createIndex("created_by", "created_by");
    chatsStore.createIndex("last_message_at", "last_message_at");
    chatsStore.createIndex("type", "type");
  }

  // Profiles store
  if (!db.objectStoreNames.contains(STORES.PROFILES)) {
    const profilesStore = db.createObjectStore(STORES.PROFILES, { keyPath: "id" });
    profilesStore.createIndex("email", "email", { unique: true }); // Unique constraint
  }

  // Chat participants with composite key
  if (oldVersion < 2) {
    if (db.objectStoreNames.contains(STORES.CHAT_PARTICIPANTS)) {
      db.deleteObjectStore(STORES.CHAT_PARTICIPANTS);
    }
    const participantsStore = db.createObjectStore(STORES.CHAT_PARTICIPANTS, { 
      keyPath: ["chat_id", "user_id"]  // Composite key
    });
    participantsStore.createIndex("chat_id", "chat_id");
    participantsStore.createIndex("user_id", "user_id");
  }

  // Sync status store
  if (!db.objectStoreNames.contains(STORES.SYNC_STATUS)) {
    const syncStore = db.createObjectStore(STORES.SYNC_STATUS, { keyPath: "id" });
    syncStore.createIndex("type", "type");
  }
};
```

**Understanding Object Stores:**

- **keyPath**: The field that serves as the primary key
- **Indexes**: Allow fast searching by specific fields
- **Composite keys**: `["chat_id", "user_id"]` creates a key from multiple fields
- **Unique constraint**: `{ unique: true }` ensures no duplicates

### 6. Transaction and Store Helpers

```typescript
// Get a transaction for one or more stores
private async getTransaction(storeNames: string | string[], mode: IDBTransactionMode = "readonly") {
  const db = await this.initDB();
  return db.transaction(storeNames, mode);
}

// Get a specific object store
private async getStore(storeName: string, mode: IDBTransactionMode = "readonly") {
  const transaction = await this.getTransaction(storeName, mode);
  return transaction.objectStore(storeName);
}
```

**Transaction Modes:**
- **"readonly"**: Can only read data (default)
- **"readwrite"**: Can read and modify data

### 7. Message Operations (CRUD)

#### Save Single Message
```typescript
async saveMessage(message: Message): Promise<void> {
  const store = await this.getStore(STORES.MESSAGES, "readwrite");
  
  return new Promise((resolve, reject) => {
    const request = store.put(message);  // put() adds or updates
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
```

#### Save Multiple Messages (Batch Operation)
```typescript
async saveMessages(messages: Message[]): Promise<void> {
  const store = await this.getStore(STORES.MESSAGES, "readwrite");
  
  return new Promise((resolve, reject) => {
    let completed = 0;
    let hasError = false;

    messages.forEach((message) => {
      const request = store.put(message);
      request.onsuccess = () => {
        completed++;
        if (completed === messages.length && !hasError) {
          resolve();  // All messages saved successfully
        }
      };
      request.onerror = () => {
        hasError = true;
        reject(request.error);
      };
    });

    if (messages.length === 0) {
      resolve();  // Handle empty array
    }
  });
}
```

**Why batch operations:**
- More efficient than saving one by one
- All operations happen in the same transaction
- Better error handling

#### Get Messages by Chat ID (Using Index)
```typescript
async getMessagesByChatId(chatId: string): Promise<Message[]> {
  const store = await this.getStore(STORES.MESSAGES);
  
  return new Promise((resolve, reject) => {
    const messages: Message[] = [];
    const index = store.index("chat_id");  // Use the chat_id index
    const request = index.openCursor(IDBKeyRange.only(chatId));  // Only this chat
    
    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) {
        messages.push(cursor.value);  // Add message to array
        cursor.continue();            // Move to next message
      } else {
        // No more messages, sort and return
        messages.sort((a, b) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        resolve(messages);
      }
    };
    
    request.onerror = () => reject(request.error);
  });
}
```

**Understanding Cursors:**
- `openCursor()`: Creates a cursor to iterate through records
- `IDBKeyRange.only(chatId)`: Only get records where chat_id equals chatId
- `cursor.continue()`: Move to the next record
- When cursor is null, we've reached the end

#### Update Message
```typescript
async updateMessage(messageId: string, updates: Partial<Message>): Promise<void> {
  const store = await this.getStore(STORES.MESSAGES, "readwrite");
  
  return new Promise(async (resolve, reject) => {
    // First, get the existing message
    const getRequest = store.get(messageId);
    getRequest.onsuccess = () => {
      const existingMessage = getRequest.result;
      if (existingMessage) {
        // Merge existing data with updates
        const updatedMessage = { ...existingMessage, ...updates };
        const putRequest = store.put(updatedMessage);
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(putRequest.error);
      } else {
        reject(new Error("Message not found"));
      }
    };
    getRequest.onerror = () => reject(getRequest.error);
  });
}
```

**Update Pattern:**
1. Get existing record
2. Merge with new data
3. Save back to store

### 8. Complex Chat Operations

#### Save Chats with Related Data
```typescript
async saveChats(chats: Chat[]): Promise<void> {
  // Use multiple stores in one transaction
  const transaction = await this.getTransaction([
    STORES.CHATS, 
    STORES.CHAT_PARTICIPANTS, 
    STORES.PROFILES
  ], "readwrite");
  
  return new Promise((resolve, reject) => {
    let completed = 0;
    let hasError = false;

    const chatStore = transaction.objectStore(STORES.CHATS);
    const participantsStore = transaction.objectStore(STORES.CHAT_PARTICIPANTS);
    const profilesStore = transaction.objectStore(STORES.PROFILES);

    chats.forEach((chat) => {
      // Save the chat itself
      const chatRequest = chatStore.put(chat);
      
      chatRequest.onsuccess = () => {
        // Save related data
        if (chat.chat_participants) {
          chat.chat_participants.forEach((participant) => {
            // Save participant relationship
            participantsStore.put({
              chat_id: chat.id,
              user_id: participant.user_id,
              role: 'member'
            });
            
            // Save user profile
            if (participant.profiles) {
              profilesStore.put(participant.profiles);
            }
          });
        }
        
        completed++;
        if (completed === chats.length && !hasError) {
          resolve();
        }
      };
      
      chatRequest.onerror = () => {
        hasError = true;
        reject(chatRequest.error);
      };
    });

    if (chats.length === 0) {
      resolve();
    }
  });
}
```

**Multi-store Transactions:**
- One transaction can span multiple object stores
- Ensures all related data is saved together
- If any part fails, everything is rolled back

#### Get All Chats with Enriched Data
```typescript
async getChats(): Promise<Chat[]> {
  const store = await this.getStore(STORES.CHATS);
  
  return new Promise(async (resolve, reject) => {
    try {
      const request = store.getAll();  // Get all chats
      request.onsuccess = async () => {
        const chats = request.result;
        
        // For each chat, get participants and their profiles
        const enrichedChats = await Promise.all(
          chats.map(async (chat) => {
            const participants = await this.getChatParticipants(chat.id);
            const participantsWithProfiles = await Promise.all(
              participants.map(async (participant) => {
                const profile = await this.getProfile(participant.user_id);
                return {
                  user_id: participant.user_id,
                  profiles: profile || {
                    // Default profile if not found
                    id: participant.user_id,
                    email: '',
                    full_name: 'Unknown User',
                    avatar_url: null,
                    phone_number: null,
                    created_at: '',
                    last_seen: null
                  }
                };
              })
            );
            
            return {
              ...chat,
              chat_participants: participantsWithProfiles
            };
          })
        );
        
        // Sort by most recent activity
        enrichedChats.sort((a, b) => {
          const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
          const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
          return bTime - aTime;
        });
        
        resolve(enrichedChats);
      };
      request.onerror = () => reject(request.error);
    } catch (error) {
      reject(error);
    }
  });
}
```

**Data Enrichment:**
- Gets basic chat data first
- Then fetches related participants and profiles
- Combines everything into rich chat objects
- Handles missing data gracefully

### 9. Delete Operations with Cascading

```typescript
async deleteChat(chatId: string): Promise<void> {
  // Delete from multiple stores
  const transaction = await this.getTransaction([
    STORES.CHATS, 
    STORES.MESSAGES, 
    STORES.CHAT_PARTICIPANTS
  ], "readwrite");
  
  return new Promise((resolve, reject) => {
    // Delete the chat
    const chatStore = transaction.objectStore(STORES.CHATS);
    chatStore.delete(chatId);

    // Delete all messages in this chat
    const messagesStore = transaction.objectStore(STORES.MESSAGES);
    const messagesIndex = messagesStore.index("chat_id");
    const messagesRequest = messagesIndex.openCursor(IDBKeyRange.only(chatId));
    
    messagesRequest.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) {
        cursor.delete();    // Delete current message
        cursor.continue();  // Move to next message
      }
    };

    // Delete all chat participants
    const participantsStore = transaction.objectStore(STORES.CHAT_PARTICIPANTS);
    const participantsIndex = participantsStore.index("chat_id");
    const participantsRequest = participantsIndex.openCursor(IDBKeyRange.only(chatId));
    
    participantsRequest.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) {
        cursor.delete();    // Delete current participant
        cursor.continue();  // Move to next participant
      }
    };

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}
```

**Cascading Deletes:**
- When deleting a chat, also delete related messages and participants
- Uses cursors to find and delete related records
- All happens in one transaction for consistency

### 10. Search Functionality

```typescript
async searchMessages(query: string, chatId?: string): Promise<Message[]> {
  const store = await this.getStore(STORES.MESSAGES);
  
  return new Promise((resolve, reject) => {
    const messages: Message[] = [];
    const request = store.openCursor();  // Iterate through all messages
    
    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) {
        const message = cursor.value;
        
        // Check if message matches search criteria
        const matchesQuery = message.content.toLowerCase().includes(query.toLowerCase());
        const matchesChat = !chatId || message.chat_id === chatId;
        
        if (matchesQuery && matchesChat) {
          messages.push(message);
        }
        
        cursor.continue();
      } else {
        // Sort results by newest first
        messages.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        resolve(messages);
      }
    };
    
    request.onerror = () => reject(request.error);
  });
}
```

**Search Implementation:**
- Iterates through all messages (could be optimized with full-text search)
- Filters by content and optionally by chat
- Returns sorted results

### 11. Utility Operations

#### Clear All Data
```typescript
async clearAllData(): Promise<void> {
  const transaction = await this.getTransaction(Object.values(STORES), "readwrite");
  
  return new Promise((resolve, reject) => {
    // Clear each object store
    Object.values(STORES).forEach((storeName) => {
      const store = transaction.objectStore(storeName);
      store.clear();  // Remove all records
    });

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}
```

#### Get Storage Statistics
```typescript
async getStorageInfo(): Promise<{
  messagesCount: number;
  chatsCount: number;
  profilesCount: number;
  estimatedSize: string;
}> {
  const [messagesCount, chatsCount, profilesCount] = await Promise.all([
    this.getCount(STORES.MESSAGES),
    this.getCount(STORES.CHATS),
    this.getCount(STORES.PROFILES),
  ]);

  // Rough size estimation
  const estimatedSize = `~${Math.round((messagesCount * 0.5 + chatsCount * 0.1 + profilesCount * 0.1) * 100) / 100} KB`;

  return {
    messagesCount,
    chatsCount,
    profilesCount,
    estimatedSize,
  };
}

private async getCount(storeName: string): Promise<number> {
  const store = await this.getStore(storeName);
  
  return new Promise((resolve, reject) => {
    const request = store.count();  // Count all records
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
```

### 12. Connection Management

```typescript
close(): void {
  if (this.db) {
    this.db.close();      // Close database connection
    this.db = null;       // Reset connection
    this.dbPromise = null; // Reset promise
  }
}
```

## 🎯 IndexedDB Best Practices Implemented

### 1. **Singleton Pattern**
```typescript
export const indexedDBService = new IndexedDBService();
```
- Only one instance of the service exists
- Prevents multiple database connections
- Ensures consistent state

### 2. **Promise-based API**
- All operations return Promises
- Easy to use with async/await
- Consistent error handling

### 3. **Transaction Management**
- Operations grouped logically
- Ensures data consistency
- Automatic rollback on errors

### 4. **Efficient Indexing**
- Indexes on commonly queried fields
- Fast lookups and sorting
- Composite keys for relationships

### 5. **Error Handling**
- Graceful degradation
- Meaningful error messages
- Proper cleanup on failures

### 6. **Memory Management**
- Proper connection cleanup
- No memory leaks
- Resource management

## 🚀 Performance Optimizations

### 1. **Batch Operations**
- Save multiple records in one transaction
- Reduces overhead
- Better performance

### 2. **Lazy Loading**
- Only load data when needed
- Reduces memory usage
- Faster initial load

### 3. **Efficient Queries**
- Use indexes for fast lookups
- Avoid full table scans
- Optimize cursor usage

### 4. **Data Normalization**
- Separate stores for different entities
- Avoid data duplication
- Easier maintenance

## 🔧 Common IndexedDB Patterns

### 1. **Check Before Create**
```typescript
if (!db.objectStoreNames.contains(STORES.MESSAGES)) {
  // Create store
}
```

### 2. **Cursor Iteration**
```typescript
const request = index.openCursor();
request.onsuccess = (event) => {
  const cursor = event.target.result;
  if (cursor) {
    // Process record
    cursor.continue();
  } else {
    // Done
  }
};
```

### 3. **Multi-store Transactions**
```typescript
const transaction = db.transaction([store1, store2], "readwrite");
```

### 4. **Promise Wrapping**
```typescript
return new Promise((resolve, reject) => {
  const request = store.get(id);
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});
```

This implementation provides a robust, scalable foundation for offline-first applications with complex data relationships and efficient querying capabilities.

## Architecture Components

### 1. Core Libraries (`/lib` folder)

#### 📁 `indexeddb.ts` - Local Database Service
The main IndexedDB service that handles all local data operations.

**Key Functions:**

- **Database Initialization:**
  ```typescript
  initDB(): Promise<IDBDatabase>
  ```
  - Creates/upgrades IndexedDB with version 2
  - Sets up 5 object stores: messages, chats, profiles, chat_participants, sync_status
  - Creates indexes for efficient querying

- **Message Operations:**
  ```typescript
  saveMessage(message: Message): Promise<void>
  saveMessages(messages: Message[]): Promise<void>
  getMessagesByChatId(chatId: string): Promise<Message[]>
  updateMessage(messageId: string, updates: Partial<Message>): Promise<void>
  deleteMessage(messageId: string): Promise<void>
  ```

- **Chat Operations:**
  ```typescript
  saveChat(chat: Chat): Promise<void>
  saveChats(chats: Chat[]): Promise<void>
  getChats(): Promise<Chat[]>
  getChat(chatId: string): Promise<Chat | null>
  updateChat(chatId: string, updates: Partial<Chat>): Promise<void>
  deleteChat(chatId: string): Promise<void>
  ```

- **Profile Operations:**
  ```typescript
  saveProfile(profile: Profile): Promise<void>
  saveProfiles(profiles: Profile[]): Promise<void>
  getProfile(profileId: string): Promise<Profile | null>
  ```

- **Sync Management:**
  ```typescript
  getSyncStatus(type: 'messages' | 'chats' | 'profiles'): Promise<SyncStatus | null>
  updateSyncStatus(type: SyncStatus['type']): Promise<void>
  ```

- **Utility Functions:**
  ```typescript
  clearAllData(): Promise<void>
  getStorageInfo(): Promise<StorageInfo>
  searchMessages(query: string, chatId?: string): Promise<Message[]>
  ```

#### 📁 `sync-service.ts` - Offline-First Synchronization
Manages bidirectional sync between local IndexedDB and remote Supabase.

**Key Features:**

- **Intelligent Sync Strategy:**
  - Only syncs new/updated data based on timestamps
  - Prevents duplicate sync operations
  - Handles optimistic updates for instant UI response

- **Core Sync Functions:**
  ```typescript
  syncMessages(chatId: string, force = false): Promise<SyncResult>
  syncChats(userId: string, force = false): Promise<SyncResult>
  syncProfiles(force = false): Promise<SyncResult>
  ```

- **Offline-First Data Access:**
  ```typescript
  getMessages(chatId: string): Promise<Message[]>  // Tries IndexedDB first, then syncs
  getChats(userId: string): Promise<Chat[]>        // Tries IndexedDB first, then syncs
  ```

- **Optimistic Updates:**
  ```typescript
  addMessageOptimistically(message: Partial<Message>): Promise<Message>
  ```
  - Immediately stores message locally
  - Schedules background sync
  - Shows instant feedback to user

- **Background Sync Scheduling:**
  ```typescript
  private scheduleSyncMessages(chatId: string, delay = 2000): void
  private scheduleSyncChats(userId: string, delay = 5000): void
  ```

#### 📁 `user-data-dao.ts` - User Session Management
Handles user session lifecycle and data isolation.

**Key Functions:**
```typescript
initializeUserSession(userId: string): Promise<void>  // Clear previous user data, set new user
terminateUserSession(): Promise<void>                 // Clean logout, clear all data
refreshUserData(userId: string): Promise<void>        // Force refresh from server
emergencyCleanup(): Promise<void>                     // Nuclear option - clear everything
```

#### 📁 `database.types.ts` - Type Definitions
TypeScript definitions for all database entities (Messages, Chats, Profiles, etc.)

## Database Schema (IndexedDB)

### Object Stores:

1. **messages**
   - Key: `id` (string)
   - Indexes: `chat_id`, `user_id`, `created_at`, `is_read`
   - Stores: Message content, timestamps, read status

2. **chats**
   - Key: `id` (string)
   - Indexes: `created_by`, `last_message_at`, `type`
   - Stores: Chat metadata, participant lists

3. **profiles**
   - Key: `id` (string)
   - Indexes: `email` (unique)
   - Stores: User profile information

4. **chat_participants**
   - Key: `[chat_id, user_id]` (composite)
   - Indexes: `chat_id`, `user_id`
   - Stores: User-chat relationships, roles, settings

5. **sync_status**
   - Key: `id` (string)
   - Indexes: `type`
   - Stores: Last sync timestamps for each data type

## Offline-First Flow

### 1. **Data Read Pattern**
```
User requests data → Check IndexedDB first → Data exists locally?
├─ Yes → Return local data → Display to user
└─ No → Fetch from Supabase → Store in IndexedDB → Display to user
           └─ Network unavailable? → Return empty/cached data
```

### 2. **Data Write Pattern (Optimistic Updates)**
```
User sends message → Store in IndexedDB immediately → Update UI instantly
                  → Schedule background sync → Network available?
                     ├─ Yes → Sync to Supabase → Update local status
                     └─ No → Queue for later sync → Retry when online
```

### 3. **Sync Strategy**
```
Sync triggered → Get last sync timestamp → Query Supabase for newer data
              → Merge with local data → Update IndexedDB
              → Update sync timestamp → Notify UI components
```

## UI Integration (`/components/chat`)

### 📁 `storage-manager.tsx` - Storage Management UI
Provides user interface for:
- Viewing storage statistics
- Manual sync controls
- Cache clearing options
- Emergency cleanup tools
- Connection status monitoring

**Key Features:**
- Real-time storage usage display
- Manual sync forcing
- User session management
- Emergency cleanup for troubleshooting

## Offline-First Benefits

### ✅ **Immediate Responsiveness**
- Messages appear instantly when sent
- No waiting for network requests
- Smooth scrolling through chat history

### ✅ **Network Resilience**
- Works completely offline
- Automatic sync when reconnected
- No data loss during network outages

### ✅ **Performance Optimization**
- IndexedDB is much faster than network requests
- Reduces server load
- Improves battery life on mobile devices

### ✅ **User Experience**
- Consistent behavior regardless of connection
- No loading spinners for cached data
- Seamless online/offline transitions

## Data Synchronization Strategy

### **Incremental Sync**
- Only fetches data newer than last sync timestamp
- Minimizes bandwidth usage
- Faster sync operations

### **Conflict Resolution**
- Server data takes precedence (for now)
- Future: Could implement CRDT or operational transforms

### **Sync Scheduling**
- Messages: 2-second delay after user action
- Chats: 5-second delay after changes
- Profiles: Manual or periodic sync

## Error Handling & Resilience

### **Network Failures**
- Operations continue using local data
- Sync operations are queued and retried
- User is notified of sync status

### **Storage Limits**
- Monitoring of IndexedDB usage
- Cleanup strategies for old data
- User controls for cache management

### **Data Corruption**
- Emergency cleanup functions
- Fresh sync capabilities
- Graceful degradation

## Security Considerations

### **Data Isolation**
- Each user's data is completely isolated
- Clean data removal on logout
- No cross-user data leakage

### **Local Storage**
- IndexedDB is origin-bound (same-origin policy)
- Data encrypted in transit to/from Supabase
- Local data protection depends on device security

## Implementation Details

### **IndexedDB Service Class Structure**
```typescript
class IndexedDBService {
  private db: IDBDatabase | null = null;
  private dbPromise: Promise<IDBDatabase> | null = null;

  // Core database operations
  private async initDB(): Promise<IDBDatabase>
  private async getTransaction(storeNames: string | string[], mode: IDBTransactionMode)
  private async getStore(storeName: string, mode: IDBTransactionMode)

  // Message CRUD operations
  async saveMessage(message: Message): Promise<void>
  async saveMessages(messages: Message[]): Promise<void>
  async getMessagesByChatId(chatId: string): Promise<Message[]>
  async getMessage(messageId: string): Promise<Message | null>
  async updateMessage(messageId: string, updates: Partial<Message>): Promise<void>
  async deleteMessage(messageId: string): Promise<void>

  // Chat CRUD operations
  async saveChat(chat: Chat): Promise<void>
  async saveChats(chats: Chat[]): Promise<void>
  async getChats(): Promise<Chat[]>
  async getChat(chatId: string): Promise<Chat | null>
  async updateChat(chatId: string, updates: Partial<Chat>): Promise<void>
  async deleteChat(chatId: string): Promise<void>

  // Profile operations
  async saveProfile(profile: Profile): Promise<void>
  async saveProfiles(profiles: Profile[]): Promise<void>
  async getProfile(profileId: string): Promise<Profile | null>

  // Chat participants
  async saveChatParticipant(participant: any): Promise<void>
  async getChatParticipants(chatId: string): Promise<any[]>

  // Sync status management
  async getSyncStatus(type: SyncStatus['type']): Promise<SyncStatus | null>
  async updateSyncStatus(type: SyncStatus['type']): Promise<void>

  // Utility functions
  async clearAllData(): Promise<void>
  async getStorageInfo(): Promise<StorageInfo>
  async searchMessages(query: string, chatId?: string): Promise<Message[]>
  close(): void
}
```

### **Sync Service Class Structure**
```typescript
class SyncService {
  private syncInProgress: Set<string> = new Set();
  private syncTimeouts: Map<string, NodeJS.Timeout> = new Map();

  // Core sync operations
  async syncMessages(chatId: string, force = false): Promise<SyncResult>
  async syncChats(userId: string, force = false): Promise<SyncResult>
  async syncProfiles(force = false): Promise<SyncResult>

  // Offline-first data access
  async getMessages(chatId: string): Promise<Message[]>
  async getChats(userId: string): Promise<Chat[]>

  // Optimistic updates
  async addMessageOptimistically(message: Omit<Message, 'id' | 'created_at'>): Promise<Message>

  // Background sync scheduling
  private scheduleSyncMessages(chatId: string, delay = 2000): void
  private scheduleSyncChats(userId: string, delay = 5000): void

  // Utility operations
  async fullSync(userId: string): Promise<SyncResults>
  async getSyncInfo(): Promise<SyncInfo>
  async clearCache(): Promise<void>
  async searchMessages(query: string, chatId?: string): Promise<Message[]>
  destroy(): void
}
```

### **User Data DAO Structure**
```typescript
class UserDataDAO {
  private currentUserId: string | null = null;

  // Session management
  async initializeUserSession(userId: string): Promise<void>
  async terminateUserSession(): Promise<void>
  async refreshUserData(userId: string): Promise<void>
  async emergencyCleanup(): Promise<void>

  // Session state
  getCurrentUserId(): string | null
  hasActiveSession(): boolean
}
```

## Best Practices Implemented

### **1. Data Consistency**
- Atomic transactions for related operations
- Proper error handling and rollback
- Consistent data validation

### **2. Performance Optimization**
- Efficient indexing strategy
- Batch operations for bulk data
- Lazy loading and pagination support

### **3. Memory Management**
- Proper cleanup of database connections
- Timeout management for sync operations
- Resource cleanup on component unmount

### **4. Error Recovery**
- Graceful degradation when IndexedDB unavailable
- Retry mechanisms for failed sync operations
- Emergency cleanup for corrupted state

### **5. User Experience**
- Optimistic updates for instant feedback
- Background sync with minimal UI disruption
- Clear status indicators for sync state

This implementation provides a robust, performant, and user-friendly offline-first chat experience that gracefully handles network connectivity issues while maintaining data consistency across devices.
