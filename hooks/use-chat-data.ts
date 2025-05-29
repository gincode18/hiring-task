import { useState, useEffect, useCallback, useRef } from "react";
import { syncService, type SyncResult } from "@/lib/sync-service";
import { type Message, type Chat } from "@/lib/indexeddb";
import { useAuth } from "@/components/providers/auth-provider";
import { supabase } from "@/lib/supabase";

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
  refreshFreshChats: () => Promise<void>;
  markMessagesAsRead: (messageIds: string[]) => Promise<void>;
  updateMessage: (messageId: string, newContent: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
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

  // Refresh fresh chats
  const refreshFreshChats = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      setState(prev => ({ ...prev, loading: false, error: null }));
      
      const chats = await syncService.getFreshChats(user.id);
      
      setState(prev => ({ 
        ...prev,
        chats,
        loading: false 
      }));
    } catch (error) {
      console.error("Error refreshing fresh chats:", error);
      setState(prev => ({ 
        ...prev,
        error: error instanceof Error ? error.message : "Failed to refresh chats",
        loading: false 
      }));
    }
  }, [user?.id]);

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

  // Mark messages as read
  const markMessagesAsRead = useCallback(async (messageIds: string[]) => {
    if (messageIds.length === 0) return;

    try {
      await syncService.markMessagesAsRead(messageIds);
      
      // Update local state immediately to reflect read status
      setState(prev => ({
        ...prev,
        messages: prev.messages.map(msg => 
          messageIds.includes(msg.id) 
            ? { ...msg, is_read: true, read_at: new Date().toISOString() }
            : msg
        )
      }));

      // Also refresh chats to update unread counts in the sidebar
      if (user?.id) {
        try {
          await refreshFreshChats();
          console.log("Refreshed chat list after marking messages as read");
        } catch (error) {
          console.warn("Failed to refresh chats after marking messages as read:", error);
        }
      }
    } catch (error) {
      console.error("Error marking messages as read:", error);
      setState(prev => ({ 
        ...prev,
        error: error instanceof Error ? error.message : "Failed to mark messages as read"
      }));
    }
  }, [user?.id, refreshFreshChats]);

  // Update message
  const updateMessage = useCallback(async (messageId: string, newContent: string) => {
    if (!user?.id || !chatId || !messageId || !newContent.trim()) return;

    try {
      await syncService.updateMessageOptimistically(messageId, newContent.trim());
      
      // Update local state immediately to reflect updated content
      setState(prev => ({
        ...prev,
        messages: prev.messages.map(msg => 
          msg.id === messageId ? { ...msg, content: newContent.trim() } : msg
        )
      }));
    } catch (error) {
      console.error("Error updating message:", error);
      setState(prev => ({ 
        ...prev,
        error: error instanceof Error ? error.message : "Failed to update message"
      }));
    }
  }, [user?.id, chatId]);

  // Delete message
  const deleteMessage = useCallback(async (messageId: string) => {
    if (!user?.id || !chatId || !messageId) return;

    try {
      await syncService.deleteMessageOptimistically(messageId);
      
      // Update local state immediately to reflect deleted status
      setState(prev => ({
        ...prev,
        messages: prev.messages.filter(msg => msg.id !== messageId)
      }));
    } catch (error) {
      console.error("Error deleting message:", error);
      setState(prev => ({ 
        ...prev,
        error: error instanceof Error ? error.message : "Failed to delete message"
      }));
    }
  }, [user?.id, chatId]);

  // Actions object
  const actions: ChatDataActions = {
    sendMessage,
    refreshMessages,
    refreshFreshMessages,
    refreshChats,
    refreshFreshChats,
    forceSync,
    searchMessages,
    clearCache,
    getSyncInfo,
    markMessagesAsRead,
    updateMessage,
    deleteMessage,
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

// Hook for managing user online status
export function useOnlineStatus() {
  const { user } = useAuth();
  const [userStatuses, setUserStatuses] = useState<Record<string, boolean>>({});
  const [isOnline, setIsOnline] = useState(true);
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Function to check if a user is online based on last_seen
  const isUserOnline = useCallback((lastSeen: string | null): boolean => {
    if (!lastSeen) {
      console.log("⚪ User has no last_seen timestamp - returning OFFLINE");
      return false;
    }
    
    const lastSeenTime = new Date(lastSeen).getTime();
    const now = new Date().getTime();
    const fiveMinutesAgo = now - (5 * 60 * 1000); // 5 minutes in milliseconds
    
    const isOnline = lastSeenTime > fiveMinutesAgo;
    const minutesAgo = Math.floor((now - lastSeenTime) / (60 * 1000));
    
    console.log(`⏰ Last seen: ${lastSeen} (${minutesAgo} minutes ago) - User is ${isOnline ? 'ONLINE' : 'OFFLINE'}`);
    
    return isOnline;
  }, []);

  // Update current user's last_seen timestamp
  const updateLastSeen = useCallback(async () => {
    if (!user?.id || !isOnline) {
      console.log("⏭️ Skipping last_seen update - user:", !!user?.id, "online:", isOnline);
      return;
    }

    try {
      console.log("🔄 Updating last_seen for user:", user.id);
      const { error } = await supabase
        .from("profiles")
        .update({ last_seen: new Date().toISOString() })
        .eq("id", user.id);

      if (error) {
        console.error("❌ Error updating last_seen:", error);
      } else {
        console.log("✅ Successfully updated last_seen for user:", user.id);
      }
    } catch (error) {
      console.error("❌ Error updating last_seen:", error);
    }
  }, [user?.id, isOnline]);

  // Fetch initial online statuses for users in chats
  const fetchUserStatuses = useCallback(async () => {
    if (!user?.id) return;

    try {
      console.log("🔍 Fetching user statuses for user:", user.id);
      // Get all unique user IDs from chat participants
      const { data: chatParticipants, error } = await supabase
        .from("chat_participants")
        .select(`
          user_id,
          profiles(id, last_seen)
        `)
        .neq("user_id", user.id); // Exclude current user

      if (error) {
        console.error("Error fetching user statuses:", error);
        return;
      }

      console.log("📋 Found chat participants:", chatParticipants);

      // Build status map
      const statusMap: Record<string, boolean> = {};
      chatParticipants.forEach((participant: any) => {
        if (participant.profiles) {
          const isOnline = isUserOnline(participant.profiles.last_seen);
          statusMap[participant.user_id] = isOnline;
          console.log(`👤 User ${participant.user_id} (last_seen: ${participant.profiles.last_seen}) is ${isOnline ? 'ONLINE' : 'OFFLINE'}`);
        }
      });

      setUserStatuses(statusMap);
      console.log("🎯 Updated user online statuses:", statusMap);
    } catch (error) {
      console.error("Error fetching user statuses:", error);
    }
  }, [user?.id, isUserOnline]);

  // Set up real-time subscription for profile changes (last_seen updates)
  useEffect(() => {
    if (!user?.id) return;

    const subscription = supabase
      .channel("profiles-online-status")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
        },
        (payload: any) => {
          const updatedProfile = payload.new;
          
          // Don't update status for current user
          if (updatedProfile.id === user.id) return;

          const isOnline = isUserOnline(updatedProfile.last_seen);
          
          setUserStatuses(prev => ({
            ...prev,
            [updatedProfile.id]: isOnline
          }));

          console.log(`User ${updatedProfile.id} is now ${isOnline ? 'online' : 'offline'}`);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user?.id, isUserOnline]);

  // Track online/offline state
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      setIsOnline(true);
      updateLastSeen(); // Update immediately when coming online
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    // Set initial state
    setIsOnline(navigator.onLine);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [updateLastSeen]);

  // Periodic last_seen updates
  useEffect(() => {
    if (!user?.id) return;

    // Update immediately
    updateLastSeen();

    // Set up periodic updates every 2 minutes
    updateIntervalRef.current = setInterval(() => {
      updateLastSeen();
    }, 2 * 60 * 1000); // 2 minutes

    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
    };
  }, [user?.id, updateLastSeen]);

  // Fetch initial statuses
  useEffect(() => {
    fetchUserStatuses();
  }, [fetchUserStatuses]);

  // Helper function to check if a specific user is online
  const isUserOnlineById = useCallback((userId: string): boolean => {
    return userStatuses[userId] || false;
  }, [userStatuses]);

  // Get online users count
  const onlineUsersCount = Object.values(userStatuses).filter(Boolean).length;

  return {
    userStatuses,
    isUserOnlineById,
    onlineUsersCount,
    refreshStatuses: fetchUserStatuses,
    isOnline,
  };
} 