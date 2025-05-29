import { supabase } from "./supabase";
import { indexedDBService, type Message, type Chat, type Profile } from "./indexeddb";

interface SyncResult {
  success: boolean;
  error?: string;
  synced: number;
}

class SyncService {
  private syncInProgress: Set<string> = new Set();
  private syncTimeouts: Map<string, NodeJS.Timeout> = new Map();

  // Messages sync
  async syncMessages(chatId: string, force = false): Promise<SyncResult> {
    const syncKey = `messages-${chatId}`;
    
    if (this.syncInProgress.has(syncKey) && !force) {
      return { success: false, error: "Sync already in progress", synced: 0 };
    }

    this.syncInProgress.add(syncKey);

    try {
      // Get last sync status
      const lastSync = await indexedDBService.getSyncStatus('messages');
      
      // Fetch messages from Supabase
      let query = supabase
        .from("messages")
        .select("*, profiles(*)")
        .eq("chat_id", chatId)
        .order("created_at", { ascending: true });

      // Only fetch newer messages if not forcing full sync
      if (!force && lastSync?.lastSyncAt) {
        query = query.gte("created_at", lastSync.lastSyncAt);
      }

      const { data: remoteMessages, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch messages: ${error.message}`);
      }

      if (remoteMessages && remoteMessages.length > 0) {
        // Store messages in IndexedDB
        await indexedDBService.saveMessages(remoteMessages as Message[]);
        
        // Update sync status
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
      this.syncInProgress.delete(syncKey);
    }
  }

  // Chats sync
  async syncChats(userId: string, force = false): Promise<SyncResult> {
    const syncKey = `chats-${userId}`;
    
    if (this.syncInProgress.has(syncKey) && !force) {
      return { success: false, error: "Sync already in progress", synced: 0 };
    }

    this.syncInProgress.add(syncKey);

    try {
      // Get last sync status
      const lastSync = await indexedDBService.getSyncStatus('chats');
      
      // Fetch chats from Supabase
      let query = supabase
        .from("chats")
        .select(`
          *,
          chat_participants(user_id, profiles(*))
        `)
        .in("id", await this.getUserChatIds(userId))
        .order("last_message_at", { ascending: false });

      // Only fetch updated chats if not forcing full sync
      if (!force && lastSync?.lastSyncAt) {
        query = query.gte("last_message_at", lastSync.lastSyncAt);
      }

      const { data: remoteChats, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch chats: ${error.message}`);
      }

      if (remoteChats && remoteChats.length > 0) {
        // Store chats in IndexedDB
        await indexedDBService.saveChats(remoteChats as Chat[]);

        // Store chat participants and profiles
        for (const chat of remoteChats) {
          if (chat.chat_participants) {
            for (const participant of chat.chat_participants) {
              // Add chat_id to participant object for IndexedDB key path
              const participantWithChatId = {
                ...participant,
                chat_id: chat.id
              };
              await indexedDBService.saveChatParticipant(participantWithChatId);
              if (participant.profiles) {
                await indexedDBService.saveProfile(participant.profiles);
              }
            }
          }
        }
        
        // Update sync status
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

  // Profiles sync
  async syncProfiles(force = false): Promise<SyncResult> {
    const syncKey = 'profiles';
    
    if (this.syncInProgress.has(syncKey) && !force) {
      return { success: false, error: "Sync already in progress", synced: 0 };
    }

    this.syncInProgress.add(syncKey);

    try {
      // Get last sync status
      const lastSync = await indexedDBService.getSyncStatus('profiles');
      
      // Fetch profiles from Supabase
      let query = supabase
        .from("profiles")
        .select("*");

      // Only fetch updated profiles if not forcing full sync
      if (!force && lastSync?.lastSyncAt) {
        query = query.gte("created_at", lastSync.lastSyncAt);
      }

      const { data: remoteProfiles, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch profiles: ${error.message}`);
      }

      if (remoteProfiles && remoteProfiles.length > 0) {
        // Store profiles in IndexedDB
        await indexedDBService.saveProfiles(remoteProfiles as Profile[]);
        
        // Update sync status
        await indexedDBService.updateSyncStatus('profiles');
      }

      return { 
        success: true, 
        synced: remoteProfiles?.length || 0 
      };

    } catch (error) {
      console.error("Profile sync error:", error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error",
        synced: 0 
      };
    } finally {
      this.syncInProgress.delete(syncKey);
    }
  }

  // Hybrid data loading: try IndexedDB first, then Supabase
  async getMessages(chatId: string): Promise<Message[]> {
    try {
      // Try to get messages from IndexedDB first
      const cachedMessages = await indexedDBService.getMessagesByChatId(chatId);
      
      if (cachedMessages.length > 0) {
        // Start background sync for fresh data
        this.scheduleSyncMessages(chatId);
        return cachedMessages;
      }

      // If no cached messages, fetch from Supabase directly
      const { data: remoteMessages, error } = await supabase
        .from("messages")
        .select("*, profiles(*)")
        .eq("chat_id", chatId)
        .order("created_at", { ascending: true });

      if (error) {
        throw new Error(`Failed to fetch messages: ${error.message}`);
      }

      const messages = (remoteMessages as Message[]) || [];
      
      // Cache the messages for future use (if IndexedDB is available)
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
      
      // If IndexedDB fails entirely, fetch directly from Supabase
      try {
        const { data: remoteMessages, error: supabaseError } = await supabase
          .from("messages")
          .select("*, profiles(*)")
          .eq("chat_id", chatId)
          .order("created_at", { ascending: true });

        if (supabaseError) {
          throw new Error(`Failed to fetch messages: ${supabaseError.message}`);
        }

        const fallbackMessages = (remoteMessages as Message[]) || [];
        return fallbackMessages;
      } catch (fallbackError) {
        console.error("Fallback fetch also failed:", fallbackError);
        return [];
      }
    }
  }

  async getChats(userId: string): Promise<Chat[]> {
    try {
      // Try to get chats from IndexedDB first
      const cachedChats = await indexedDBService.getChats();
      
      if (cachedChats.length > 0) {
        // Start background sync for fresh data
        this.scheduleSyncChats(userId);
        return cachedChats;
      }

      // If no cached chats, fetch from Supabase directly
      const { data: remoteChats, error } = await supabase
        .from("chats")
        .select(`
          *,
          chat_participants(user_id, profiles(*))
        `)
        .in("id", await this.getUserChatIds(userId))
        .order("last_message_at", { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch chats: ${error.message}`);
      }

      const chats = (remoteChats as Chat[]) || [];
      
      // Cache the chats for future use (if IndexedDB is available)
      if (chats.length > 0) {
        try {
          await indexedDBService.saveChats(chats);
          await indexedDBService.updateSyncStatus('chats');
        } catch (cacheError) {
          console.warn("Failed to cache chats:", cacheError);
          // Continue without caching
        }
      }

      return chats;

    } catch (error) {
      console.error("Error getting chats:", error);
      
      // If IndexedDB fails entirely, fetch directly from Supabase
      try {
        const { data: remoteChats, error: supabaseError } = await supabase
          .from("chats")
          .select(`
            *,
            chat_participants(user_id, profiles(*))
          `)
          .in("id", await this.getUserChatIds(userId))
          .order("last_message_at", { ascending: false });

        if (supabaseError) {
          throw new Error(`Failed to fetch chats: ${supabaseError.message}`);
        }

        return (remoteChats as Chat[]) || [];
      } catch (fallbackError) {
        console.error("Fallback fetch also failed:", fallbackError);
        return [];
      }
    }
  }

  // Optimistic updates for new messages
  async addMessageOptimistically(message: Omit<Message, 'id' | 'created_at'>): Promise<Message> {
    // Create optimistic message with temporary ID
    const optimisticMessage: Message = {
      ...message,
      id: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      created_at: new Date().toISOString(),
    };

    try {
      // Save optimistically to IndexedDB
      await indexedDBService.saveMessage(optimisticMessage);

      // Try to send to Supabase
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

      // Replace optimistic message with real one
      if (savedMessage) {
        await indexedDBService.deleteMessage(optimisticMessage.id);
        await indexedDBService.saveMessage(savedMessage as Message);
        return savedMessage as Message;
      }

      return optimisticMessage;

    } catch (error) {
      console.error("Error adding message:", error);
      // Mark message as failed to sync (you could add a 'sync_status' field)
      return optimisticMessage;
    }
  }

  // Optimistic updates for editing messages
  async updateMessageOptimistically(messageId: string, newContent: string): Promise<Message | null> {
    try {
      console.log("syncService.updateMessageOptimistically - Updating message:", messageId, "with content:", newContent);
      
      // First, get the current message from cache
      const currentMessage = await indexedDBService.getMessage(messageId);
      if (!currentMessage) {
        throw new Error("Message not found in cache");
      }

      // Create updated message for optimistic update
      const updatedMessage: Message = {
        ...currentMessage,
        content: newContent,
      };

      // Save optimistically to IndexedDB
      await indexedDBService.saveMessage(updatedMessage);
      console.log("syncService.updateMessageOptimistically - Updated message in cache");

      // Try to update in Supabase
      const { data: savedMessage, error } = await supabase
        .from("messages")
        .update({ 
          content: newContent
        })
        .eq("id", messageId)
        .select("*, profiles(*)")
        .single();

      if (error) {
        throw error;
      }

      // Update cache with server response
      if (savedMessage) {
        await indexedDBService.saveMessage(savedMessage as Message);
        console.log("syncService.updateMessageOptimistically - Updated message from server response");
        return savedMessage as Message;
      }

      return updatedMessage;

    } catch (error) {
      console.error("Error updating message:", error);
      
      // Try to revert the optimistic update
      try {
        const originalMessage = await indexedDBService.getMessage(messageId);
        if (originalMessage) {
          // Revert to original content
          const revertedMessage = { ...originalMessage };
          await indexedDBService.saveMessage(revertedMessage);
        }
      } catch (revertError) {
        console.error("Failed to revert optimistic update:", revertError);
      }
      
      throw error;
    }
  }

  // Optimistic updates for deleting messages
  async deleteMessageOptimistically(messageId: string): Promise<void> {
    try {
      console.log("syncService.deleteMessageOptimistically - Deleting message:", messageId);
      
      // First, get the current message from cache for potential rollback
      const messageToDelete = await indexedDBService.getMessage(messageId);
      if (!messageToDelete) {
        throw new Error("Message not found in cache");
      }

      // Delete optimistically from IndexedDB
      await indexedDBService.deleteMessage(messageId);
      console.log("syncService.deleteMessageOptimistically - Deleted message from cache");

      // Try to delete from Supabase
      const { error } = await supabase
        .from("messages")
        .delete()
        .eq("id", messageId);

      if (error) {
        throw error;
      }

      console.log("syncService.deleteMessageOptimistically - Successfully deleted message from server");

    } catch (error) {
      console.error("Error deleting message:", error);
      
      // Try to restore the message if deletion failed
      try {
        const messageToDelete = await indexedDBService.getMessage(messageId);
        if (!messageToDelete) {
          // We need to restore from a backup - in a real app, you might want to store this differently
          console.warn("Cannot restore deleted message - no backup available");
        }
      } catch (restoreError) {
        console.error("Failed to restore deleted message:", restoreError);
      }
      
      throw error;
    }
  }

  // Schedule background syncs with debouncing
  private scheduleSyncMessages(chatId: string, delay = 2000): void {
    const key = `messages-${chatId}`;
    
    // Clear existing timeout
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

  private scheduleSyncChats(userId: string, delay = 5000): void {
    const key = `chats-${userId}`;
    
    // Clear existing timeout
    if (this.syncTimeouts.has(key)) {
      clearTimeout(this.syncTimeouts.get(key)!);
    }

    // Schedule new sync
    const timeout = setTimeout(() => {
      this.syncChats(userId);
      this.syncTimeouts.delete(key);
    }, delay);

    this.syncTimeouts.set(key, timeout);
  }

  // Force full sync of all data
  async fullSync(userId: string): Promise<{
    messages: SyncResult;
    chats: SyncResult;
    profiles: SyncResult;
  }> {
    const [messagesResult, chatsResult, profilesResult] = await Promise.allSettled([
      this.syncMessages('', true), // Empty chatId for all messages
      this.syncChats(userId, true),
      this.syncProfiles(true),
    ]);

    return {
      messages: messagesResult.status === 'fulfilled' ? messagesResult.value : { success: false, error: 'Failed', synced: 0 },
      chats: chatsResult.status === 'fulfilled' ? chatsResult.value : { success: false, error: 'Failed', synced: 0 },
      profiles: profilesResult.status === 'fulfilled' ? profilesResult.value : { success: false, error: 'Failed', synced: 0 },
    };
  }

  // Get sync status for all data types
  async getSyncInfo(): Promise<{
    messages?: { lastSyncAt: string };
    chats?: { lastSyncAt: string };
    profiles?: { lastSyncAt: string };
    storage: {
      messagesCount: number;
      chatsCount: number;
      profilesCount: number;
      estimatedSize: string;
    };
  }> {
    const [messagesSync, chatsSync, profilesSync, storageInfo] = await Promise.all([
      indexedDBService.getSyncStatus('messages'),
      indexedDBService.getSyncStatus('chats'),
      indexedDBService.getSyncStatus('profiles'),
      indexedDBService.getStorageInfo(),
    ]);

    return {
      messages: messagesSync ? { lastSyncAt: messagesSync.lastSyncAt } : undefined,
      chats: chatsSync ? { lastSyncAt: chatsSync.lastSyncAt } : undefined,
      profiles: profilesSync ? { lastSyncAt: profilesSync.lastSyncAt } : undefined,
      storage: storageInfo,
    };
  }

  // Clear all cached data
  async clearCache(): Promise<void> {
    await indexedDBService.clearAllData();
  }

  // Search messages across all chats or specific chat
  async searchMessages(query: string, chatId?: string): Promise<Message[]> {
    return await indexedDBService.searchMessages(query, chatId);
  }

  // Cleanup timeouts
  destroy(): void {
    this.syncTimeouts.forEach((timeout) => clearTimeout(timeout));
    this.syncTimeouts.clear();
    this.syncInProgress.clear();
  }

  // Force fresh message loading from Supabase (for real-time events)
  async getFreshMessages(chatId: string): Promise<Message[]> {
    try {
      console.log("syncService.getFreshMessages - Fetching fresh messages from Supabase for chatId:", chatId);
      
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
      console.log("syncService.getFreshMessages - Got fresh messages:", messages.length);
      
      // Update IndexedDB cache with fresh data
      if (messages.length > 0) {
        try {
          await indexedDBService.saveMessages(messages);
          await indexedDBService.updateSyncStatus('messages');
          console.log("syncService.getFreshMessages - Updated cache with fresh messages");
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

  // Force fresh chat loading from Supabase (for real-time events)
  async getFreshChats(userId: string): Promise<Chat[]> {
    try {
      console.log("syncService.getFreshChats - Fetching fresh chats from Supabase for userId:", userId);
      
      // Always fetch from Supabase, ignore cache
      const chatIds = await this.getUserChatIds(userId);
      
      const { data: remoteChats, error } = await supabase
        .from("chats")
        .select(`
          *,
          chat_participants(user_id, profiles(*))
        `)
        .in("id", chatIds)
        .order("last_message_at", { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch fresh chats: ${error.message}`);
      }

      const chats = (remoteChats as Chat[]) || [];
      console.log("syncService.getFreshChats - Got fresh chats:", chats.length);
      
      // Update IndexedDB cache with fresh data
      if (chats.length > 0) {
        try {
          await indexedDBService.saveChats(chats);

          // Store chat participants and profiles
          for (const chat of chats) {
            if (chat.chat_participants) {
              for (const participant of chat.chat_participants) {
                // Add chat_id to participant object for IndexedDB key path
                const participantWithChatId = {
                  ...participant,
                  chat_id: chat.id
                };
                await indexedDBService.saveChatParticipant(participantWithChatId);
                if (participant.profiles) {
                  await indexedDBService.saveProfile(participant.profiles);
                }
              }
            }
          }

          await indexedDBService.updateSyncStatus('chats');
          console.log("syncService.getFreshChats - Updated cache with fresh chats");
        } catch (cacheError) {
          console.warn("Failed to update cache with fresh chats:", cacheError);
        }
      }

      return chats;

    } catch (error) {
      console.error("Error getting fresh chats:", error);
      // Fallback to regular cached method
      return this.getChats(userId);
    }
  }

  // Optimistically mark messages as read in both cache and server
  async markMessagesAsRead(messageIds: string[]): Promise<void> {
    if (messageIds.length === 0) return;

    try {
      console.log("syncService.markMessagesAsRead - Marking messages as read:", messageIds);
      
      // First, optimistically update IndexedDB for immediate UI feedback
      const readAt = new Date().toISOString();
      await Promise.all(
        messageIds.map(async (messageId) => {
          try {
            // Get the message from cache
            const cachedMessage = await indexedDBService.getMessage(messageId);
            if (cachedMessage) {
              // Update the message in cache
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

      // Then, update in Supabase
      const { error } = await supabase
        .from("messages")
        .update({ is_read: true, read_at: readAt })
        .in("id", messageIds);

      if (error) {
        console.error("Error marking messages as read in Supabase:", error);
        // Could implement retry logic or rollback cache changes here
        throw error;
      }

      console.log("Successfully marked messages as read in both cache and server");

    } catch (error) {
      console.error("Error in markMessagesAsRead:", error);
      throw error;
    }
  }

  // Helper method to get chat IDs where user is a participant
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
}

// Export singleton instance
export const syncService = new SyncService();

// Export types
export type { SyncResult }; 