import { useState, useEffect, useCallback, useRef } from "react";
import { syncService, type SyncResult } from "@/lib/sync-service";
import { type Message, type Chat } from "@/lib/indexeddb";
import { useAuth } from "@/components/providers/auth-provider";

interface UseChatDataOptions {
  chatId?: string;
  autoSync?: boolean;
  syncInterval?: number;
}

interface ChatDataState {
  messages: Message[];
  chats: Chat[];
  loading: boolean;
  error: string | null;
  syncing: boolean;
  lastSync?: string;
}

interface ChatDataActions {
  sendMessage: (content: string, type?: string) => Promise<Message | null>;
  refreshMessages: () => Promise<void>;
  refreshFreshMessages: () => Promise<void>;
  refreshChats: () => Promise<void>;
  forceSync: () => Promise<void>;
  searchMessages: (query: string) => Promise<Message[]>;
  clearCache: () => Promise<void>;
  getSyncInfo: () => Promise<any>;
}

export function useChatData(options: UseChatDataOptions = {}): [ChatDataState, ChatDataActions] {
  const { user } = useAuth();
  const { chatId, autoSync = true, syncInterval = 30000 } = options;
  
  const [state, setState] = useState<ChatDataState>({
    messages: [],
    chats: [],
    loading: !!chatId,
    error: null,
    syncing: false,
  });

  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  // Safe state updates only when component is mounted
  const safeSetState = useCallback((update: Partial<ChatDataState>) => {
    if (mountedRef.current) {
      setState(prev => ({ ...prev, ...update }));
    }
  }, []);

  // Load messages for a specific chat
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
      console.error("Error loading messages:", error);
      setState(prev => ({ 
        ...prev,
        error: error instanceof Error ? error.message : "Failed to load messages",
        loading: false 
      }));
    }
  }, []);

  // Load chats for the current user
  const loadChats = useCallback(async () => {
    if (!user?.id) return;

    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      const chats = await syncService.getChats(user.id);
      
      setState(prev => ({ 
        ...prev,
        chats,
        loading: false 
      }));
    } catch (error) {
      console.error("Error loading chats:", error);
      setState(prev => ({ 
        ...prev,
        error: error instanceof Error ? error.message : "Failed to load chats",
        loading: false 
      }));
    }
  }, [user?.id]);

  // Send a new message
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
      console.error("Error sending message:", error);
      setState(prev => ({ 
        ...prev,
        error: error instanceof Error ? error.message : "Failed to send message"
      }));
      return null;
    }
  }, [user?.id, chatId]);

  // Refresh messages with fresh data from Supabase (for real-time)
  const refreshFreshMessages = useCallback(async () => {
    if (!chatId) return;
    
    try {
      setState(prev => ({ ...prev, loading: false, error: null })); // Don't show loading spinner for real-time updates
      
      const messages = await syncService.getFreshMessages(chatId);
      
      setState(prev => ({ 
        ...prev,
        messages,
        loading: false 
      }));
    } catch (error) {
      console.error("Error refreshing fresh messages:", error);
      setState(prev => ({ 
        ...prev,
        error: error instanceof Error ? error.message : "Failed to refresh messages",
        loading: false 
      }));
    }
  }, [chatId]);

  // Refresh messages
  const refreshMessages = useCallback(async () => {
    if (!chatId) return;
    await loadMessages(chatId);
  }, [chatId]);

  // Refresh chats
  const refreshChats = useCallback(async () => {
    await loadChats();
  }, [loadChats]);

  // Force full sync
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

      // Get updated sync info
      const syncInfo = await syncService.getSyncInfo();
      
      safeSetState({ 
        syncing: false,
        lastSync: new Date().toISOString(),
        error: null 
      });

      console.log("Sync completed:", syncResults, syncInfo);
    } catch (error) {
      console.error("Error during sync:", error);
      safeSetState({ 
        syncing: false,
        error: error instanceof Error ? error.message : "Sync failed"
      });
    }
  }, [user?.id, chatId, loadMessages, loadChats, safeSetState]);

  // Search messages
  const searchMessages = useCallback(async (query: string): Promise<Message[]> => {
    if (!query.trim()) return [];
    
    try {
      return await syncService.searchMessages(query, chatId);
    } catch (error) {
      console.error("Error searching messages:", error);
      return [];
    }
  }, [chatId]);

  // Clear cache
  const clearCache = useCallback(async () => {
    try {
      await syncService.clearCache();
      safeSetState({
        messages: [],
        chats: [],
        lastSync: undefined,
      });
      
      // Reload data
      await Promise.all([
        chatId ? loadMessages(chatId) : Promise.resolve(),
        loadChats(),
      ]);
    } catch (error) {
      console.error("Error clearing cache:", error);
      safeSetState({ 
        error: error instanceof Error ? error.message : "Failed to clear cache"
      });
    }
  }, [chatId, loadMessages, loadChats, safeSetState]);

  // Get sync info
  const getSyncInfo = useCallback(async () => {
    try {
      return await syncService.getSyncInfo();
    } catch (error) {
      console.error("Error getting sync info:", error);
      return null;
    }
  }, []);

  // Auto-sync setup
  useEffect(() => {
    if (!autoSync || !user?.id) return;

    const startAutoSync = () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }

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
        syncIntervalRef.current = null;
      }
    };
  }, [autoSync, user?.id, chatId, syncInterval]);

  // Load initial data
  useEffect(() => {
    if (!user?.id) return;

    const loadInitialData = async () => {
      await loadChats();
      if (chatId) {
        await loadMessages(chatId);
      } else {
        setState(prev => ({ ...prev, messages: [], loading: false }));
      }
    };

    loadInitialData();
  }, [user?.id, chatId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, []);

  // Actions object
  const actions: ChatDataActions = {
    sendMessage,
    refreshMessages,
    refreshFreshMessages,
    refreshChats,
    forceSync,
    searchMessages,
    clearCache,
    getSyncInfo,
  };

  return [state, actions];
}

// Hook for managing offline status and sync
export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(true); // Default to true for SSR
  const [pendingSync, setPendingSync] = useState(false);
  const { user } = useAuth();

  // Set actual online status after component mounts
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsOnline(navigator.onLine);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = async () => {
      setIsOnline(true);
      
      if (user?.id && pendingSync) {
        try {
          setPendingSync(false);
          await syncService.fullSync(user.id);
          console.log("Offline sync completed");
        } catch (error) {
          console.error("Offline sync failed:", error);
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

  return {
    isOnline,
    pendingSync,
    syncWhenOnline: () => setPendingSync(true),
  };
}

// Hook for storage management
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

  return {
    storageInfo,
    loading,
    refresh: refreshStorageInfo,
  };
} 