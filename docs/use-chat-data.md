# useChatData Hook Documentation

## 🎯 Overview

The `useChatData` hook is a comprehensive React custom hook that provides a complete data management layer for the chat application. It integrates with the sync service, manages local state, handles real-time updates, and provides a clean API for React components to interact with chat data.

## 🏗️ Architecture Pattern

The hook implements a **Facade Pattern** that abstracts complex data operations behind a simple interface:

1. **State Management**: Manages loading, error, and data states
2. **Data Operations**: Provides CRUD operations for messages and chats
3. **Real-time Integration**: Handles live updates and synchronization
4. **Offline Support**: Manages offline/online state transitions
5. **Performance Optimization**: Implements caching and efficient updates

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ React Component │    │  useChatData    │    │  Sync Service   │
│                 │    │                 │    │                 │
│ 1. Call Hook    │───▶│ 2. Manage State │───▶│ 3. Data Ops     │
│                 │    │                 │    │                 │
│ 4. Render UI    │◀───│ 5. Return State │◀───│ 6. Real-time    │
│                 │    │    & Actions    │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🔧 Core Components

### 1. Hook Interface

```typescript
interface UseChatDataOptions {
  chatId?: string;        // Specific chat to load messages for
  autoSync?: boolean;     // Enable automatic background sync
  syncInterval?: number;  // How often to sync (milliseconds)
}

interface ChatDataState {
  messages: Message[];    // Current chat messages
  chats: Chat[];         // User's chat list
  loading: boolean;      // Loading indicator
  error: string | null;  // Error message
  syncing: boolean;      // Background sync indicator
  lastSync?: string;     // Last sync timestamp
}

interface ChatDataActions {
  sendMessage: (content: string, type?: string) => Promise<Message | null>;
  refreshMessages: () => Promise<void>;
  refreshFreshMessages: () => Promise<void>;
  refreshChats: () => Promise<void>;
  refreshFreshChats: () => Promise<void>;
  markMessagesAsRead: (messageIds: string[]) => Promise<void>;
  forceSync: () => Promise<void>;
  searchMessages: (query: string) => Promise<Message[]>;
  clearCache: () => Promise<void>;
  getSyncInfo: () => Promise<any>;
}
```

**Return Pattern:**
```typescript
const [state, actions] = useChatData(options);
```

This tuple pattern separates read-only state from action methods, making the API clear and predictable.

### 2. State Management

```typescript
const [state, setState] = useState<ChatDataState>({
  messages: [],
  chats: [],
  loading: !!chatId,      // Only show loading if specific chat requested
  error: null,
  syncing: false,
});
```

**State Design Decisions:**
- **Immutable Updates**: Always create new state objects
- **Granular Loading**: Different loading states for different operations
- **Error Isolation**: Errors don't break the entire state
- **Optimistic UI**: State updates immediately for better UX

## 📊 Core Functionality

### 1. Message Loading

```typescript
const loadMessages = useCallback(async (targetChatId: string) => {
  if (!targetChatId) return;

  try {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    const messages = await syncService.getMessages(targetChatId);
    
    setState(prev => ({ 
      ...prev,
      messages,
      loading: false 
    }));
  } catch (error) {
    setState(prev => ({ 
      ...prev,
      error: error instanceof Error ? error.message : "Failed to load messages",
      loading: false 
    }));
  }
}, []);
```

**Key Features:**
- **Error Handling**: Comprehensive error catching and user feedback
- **Loading States**: Clear loading indicators for better UX
- **Type Safety**: Proper TypeScript error handling
- **State Isolation**: Errors don't affect other parts of the state

### 2. Real-time Message Updates

```typescript
const refreshFreshMessages = useCallback(async () => {
  if (!chatId) return;
  
  try {
    setState(prev => ({ ...prev, loading: false, error: null })); // No spinner for real-time
    
    const messages = await syncService.getFreshMessages(chatId);
    
    setState(prev => ({ 
      ...prev,
      messages,
      loading: false 
    }));
  } catch (error) {
    // Handle error without disrupting user experience
  }
}, [chatId]);
```

**Real-time Optimization:**
- **No Loading Spinner**: Real-time updates shouldn't show loading states
- **Silent Errors**: Don't disrupt user experience with real-time update errors
- **Fresh Data**: Always fetch latest data from server for real-time events

### 3. Optimistic Message Sending

```typescript
const sendMessage = useCallback(async (content: string, type: string = 'text'): Promise<Message | null> => {
  if (!user?.id || !chatId || !content.trim()) return null;

  try {
    const message = await syncService.addMessageOptimistically({
      chat_id: chatId,
      user_id: user.id,
      content: content.trim(),
      type,
      is_read: false,
      read_at: null,
    });

    // Update local state immediately
    setState(prev => ({
      ...prev,
      messages: [...prev.messages, message],
    }));

    return message;
  } catch (error) {
    setState(prev => ({ 
      ...prev,
      error: error instanceof Error ? error.message : "Failed to send message"
    }));
    return null;
  }
}, [user?.id, chatId]);
```

**Optimistic Update Pattern:**
1. **Immediate UI Update**: Message appears instantly in chat
2. **Background Sync**: Send to server in background
3. **Error Handling**: Show error if send fails
4. **State Consistency**: Keep UI and server in sync

## 🔄 Advanced Features

### 1. Auto-Sync System

```typescript
useEffect(() => {
  if (!autoSync || !user?.id) return;

  const startAutoSync = () => {
    syncIntervalRef.current = setInterval(async () => {
      try {
        if (user?.id) {
          await syncService.syncChats(user.id);
          if (chatId) {
            await syncService.syncMessages(chatId);
          }
        }
      } catch (error) {
        console.error("Auto-sync error:", error);
      }
    }, syncInterval);
  };

  startAutoSync();

  return () => {
    if (syncIntervalRef.current) {
      clearInterval(syncIntervalRef.current);
    }
  };
}, [autoSync, user?.id, chatId, syncInterval]);
```

**Auto-Sync Benefits:**
- **Background Updates**: Keeps data fresh without user action
- **Configurable**: Can be enabled/disabled and interval adjusted
- **Resource Efficient**: Only syncs when user is active
- **Error Resilient**: Continues working even if individual syncs fail

### 2. Read Receipt Management

```typescript
const markMessagesAsRead = useCallback(async (messageIds: string[]) => {
  if (messageIds.length === 0) return;

  try {
    await syncService.markMessagesAsRead(messageIds);
    
    // Update local state immediately
    setState(prev => ({
      ...prev,
      messages: prev.messages.map(msg => 
        messageIds.includes(msg.id) 
          ? { ...msg, is_read: true, read_at: new Date().toISOString() }
          : msg
      )
    }));
  } catch (error) {
    setState(prev => ({ 
      ...prev,
      error: error instanceof Error ? error.message : "Failed to mark messages as read"
    }));
  }
}, []);
```

**Read Receipt Pattern:**
- **Optimistic Update**: UI updates immediately
- **Server Sync**: Background update to server
- **Batch Operation**: Handle multiple messages efficiently
- **Error Recovery**: Handle failures gracefully

### 3. Force Sync Operation

```typescript
const forceSync = useCallback(async () => {
  if (!user?.id) return;

  try {
    safeSetState({ syncing: true });
    
    const syncResults = await syncService.fullSync(user.id);
    
    // Reload data after sync
    await Promise.all([
      chatId ? loadMessages(chatId) : Promise.resolve(),
      loadChats(),
    ]);

    safeSetState({ 
      syncing: false,
      lastSync: new Date().toISOString(),
      error: null 
    });
  } catch (error) {
    safeSetState({ 
      syncing: false,
      error: error instanceof Error ? error.message : "Sync failed"
    });
  }
}, [user?.id, chatId, loadMessages, loadChats, safeSetState]);
```

**Force Sync Use Cases:**
- **Manual Refresh**: User pulls to refresh
- **Error Recovery**: Recover from sync failures
- **Initial Load**: Ensure fresh data on app start
- **Network Recovery**: Sync after coming back online

## 🛡️ Safety & Performance Features

### 1. Safe State Updates

```typescript
const mountedRef = useRef(true);

const safeSetState = useCallback((update: Partial<ChatDataState>) => {
  if (mountedRef.current) {
    setState(prev => ({ ...prev, ...update }));
  }
}, []);

useEffect(() => {
  return () => {
    mountedRef.current = false;
  };
}, []);
```

**Memory Leak Prevention:**
- **Mount Tracking**: Only update state if component is mounted
- **Cleanup**: Prevent updates after component unmounts
- **Race Condition Protection**: Avoid state updates from stale async operations

### 2. Dependency Optimization

```typescript
const loadMessages = useCallback(async (targetChatId: string) => {
  // Implementation
}, []); // No dependencies - stable reference

const sendMessage = useCallback(async (content: string, type: string = 'text') => {
  // Implementation
}, [user?.id, chatId]); // Only re-create when dependencies change
```

**Performance Benefits:**
- **Stable References**: Prevent unnecessary re-renders
- **Minimal Dependencies**: Only include what actually changes
- **Memoization**: Expensive operations are cached

## 🔧 Additional Hooks

### 1. Offline Sync Hook

```typescript
export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingSync, setPendingSync] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      
      if (user?.id && pendingSync) {
        try {
          setPendingSync(false);
          await syncService.fullSync(user.id);
        } catch (error) {
          setPendingSync(true);
        }
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setPendingSync(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [user?.id, pendingSync]);

  return { isOnline, pendingSync, syncWhenOnline: () => setPendingSync(true) };
}
```

**Offline Support:**
- **Network Detection**: Automatically detect online/offline status
- **Pending Sync**: Track when sync is needed
- **Auto Recovery**: Sync when connection returns
- **Manual Trigger**: Allow manual sync requests

### 2. Storage Info Hook

```typescript
export function useStorageInfo() {
  const [storageInfo, setStorageInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const refreshStorageInfo = useCallback(async () => {
    try {
      setLoading(true);
      const info = await syncService.getSyncInfo();
      setStorageInfo(info);
    } catch (error) {
      console.error("Error getting storage info:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshStorageInfo();
  }, [refreshStorageInfo]);

  return { storageInfo, loading, refresh: refreshStorageInfo };
}
```

**Storage Management:**
- **Cache Analytics**: Monitor storage usage
- **Sync Status**: Track last sync times
- **Performance Metrics**: Measure cache effectiveness
- **Debug Information**: Help with troubleshooting

## 🔧 Integration Patterns

### 1. Basic Chat Component

```typescript
function ChatComponent({ chatId }: { chatId: string }) {
  const [{ messages, loading, error }, { sendMessage, markMessagesAsRead }] = useChatData({ 
    chatId,
    autoSync: true 
  });

  const handleSend = async (content: string) => {
    const message = await sendMessage(content);
    if (message) {
      // Message sent successfully
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;

  return (
    <div>
      <MessageList messages={messages} onMarkRead={markMessagesAsRead} />
      <MessageInput onSend={handleSend} />
    </div>
  );
}
```

### 2. Chat List Component

```typescript
function ChatListComponent() {
  const [{ chats, loading }, { refreshChats, forceSync }] = useChatData({ 
    autoSync: true,
    syncInterval: 10000 
  });

  const handleRefresh = async () => {
    await forceSync();
  };

  return (
    <div>
      <RefreshButton onClick={handleRefresh} />
      <ChatList chats={chats} loading={loading} />
    </div>
  );
}
```

### 3. Real-time Integration

```typescript
function ChatWithRealtime({ chatId }: { chatId: string }) {
  const [state, actions] = useChatData({ chatId });

  useEffect(() => {
    const subscription = supabase
      .channel(`messages:${chatId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `chat_id=eq.${chatId}`
      }, async () => {
        // Refresh with fresh data when real-time event received
        await actions.refreshFreshMessages();
      })
      .subscribe();

    return () => subscription.unsubscribe();
  }, [chatId, actions.refreshFreshMessages]);

  return <ChatComponent state={state} actions={actions} />;
}
```

## 🎯 Design Principles

### 1. **Separation of Concerns**
- **State Management**: Hook manages all state logic
- **Data Operations**: Sync service handles data operations
- **UI Logic**: Components focus on rendering

### 2. **Predictable API**
- **Tuple Return**: `[state, actions]` pattern is familiar
- **Consistent Naming**: Clear, descriptive method names
- **Type Safety**: Full TypeScript support

### 3. **Performance First**
- **Optimistic Updates**: Immediate UI feedback
- **Background Sync**: Non-blocking operations
- **Efficient Re-renders**: Minimal dependency arrays

### 4. **Error Resilience**
- **Graceful Degradation**: App continues working despite errors
- **User Feedback**: Clear error messages
- **Recovery Options**: Ways to retry failed operations

### 5. **Developer Experience**
- **Simple Integration**: Easy to use in components
- **Comprehensive Features**: Everything needed for chat functionality
- **Debugging Support**: Clear logging and error reporting

## 🚀 Usage Examples

### Basic Usage
```typescript
const [{ messages, loading }, { sendMessage }] = useChatData({ 
  chatId: "chat-123" 
});
```

### With Auto-Sync
```typescript
const [state, actions] = useChatData({ 
  chatId: "chat-123",
  autoSync: true,
  syncInterval: 5000 
});
```

### Chat List Only
```typescript
const [{ chats }, { refreshChats }] = useChatData({ 
  autoSync: true 
});
```

### Offline Support
```typescript
const [chatState, chatActions] = useChatData({ chatId });
const { isOnline, pendingSync } = useOfflineSync();

if (!isOnline) {
  return <OfflineIndicator pendingSync={pendingSync} />;
}
```

### Storage Management
```typescript
const { storageInfo, refresh } = useStorageInfo();

return (
  <div>
    <p>Messages: {storageInfo?.storage.messagesCount}</p>
    <p>Storage: {storageInfo?.storage.estimatedSize}</p>
    <button onClick={refresh}>Refresh Info</button>
  </div>
);
```

## 🎯 Key Benefits

### For Components
- **Simple API**: Easy to integrate and use
- **Complete Functionality**: Everything needed for chat features
- **Type Safety**: Full TypeScript support
- **Performance**: Optimized for React rendering

### For Users
- **Instant Feedback**: Optimistic updates for immediate response
- **Offline Support**: Works without internet connection
- **Real-time Updates**: Live chat experience
- **Reliable**: Handles errors gracefully

### For Developers
- **Reusable**: Works across different chat components
- **Maintainable**: Clear separation of concerns
- **Debuggable**: Comprehensive logging and error handling
- **Extensible**: Easy to add new features

The `useChatData` hook is the primary interface between React components and the chat data layer, providing a powerful, flexible, and easy-to-use API for building chat applications. 