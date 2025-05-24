import { Database } from "./database.types";

// Type definitions
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

// IndexedDB schema version
const DB_VERSION = 2;
const DB_NAME = "ChatAppDB";

// Object store names
const STORES = {
  MESSAGES: "messages",
  CHATS: "chats",
  PROFILES: "profiles",
  CHAT_PARTICIPANTS: "chat_participants",
  SYNC_STATUS: "sync_status",
} as const;

interface SyncStatus {
  id: string;
  lastSyncAt: string;
  type: 'messages' | 'chats' | 'profiles';
}

class IndexedDBService {
  private db: IDBDatabase | null = null;
  private dbPromise: Promise<IDBDatabase> | null = null;

  private async initDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    if (this.dbPromise) return this.dbPromise;

    // Check if IndexedDB is available
    if (typeof window === 'undefined' || !window.indexedDB) {
      throw new Error('IndexedDB is not available in this environment');
    }

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(request.result);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const oldVersion = (event as IDBVersionChangeEvent).oldVersion;

        // Messages store
        if (!db.objectStoreNames.contains(STORES.MESSAGES)) {
          const messagesStore = db.createObjectStore(STORES.MESSAGES, { keyPath: "id" });
          messagesStore.createIndex("chat_id", "chat_id");
          messagesStore.createIndex("user_id", "user_id");
          messagesStore.createIndex("created_at", "created_at");
          messagesStore.createIndex("is_read", "is_read");
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
          profilesStore.createIndex("email", "email", { unique: true });
        }

        // Chat participants store - recreate for v2
        if (oldVersion < 2) {
          // Delete old store if it exists
          if (db.objectStoreNames.contains(STORES.CHAT_PARTICIPANTS)) {
            db.deleteObjectStore(STORES.CHAT_PARTICIPANTS);
          }
          // Create new store with composite key
          const participantsStore = db.createObjectStore(STORES.CHAT_PARTICIPANTS, { keyPath: ["chat_id", "user_id"] });
          participantsStore.createIndex("chat_id", "chat_id");
          participantsStore.createIndex("user_id", "user_id");
        }

        // Sync status store
        if (!db.objectStoreNames.contains(STORES.SYNC_STATUS)) {
          const syncStore = db.createObjectStore(STORES.SYNC_STATUS, { keyPath: "id" });
          syncStore.createIndex("type", "type");
        }
      };
    });

    return this.dbPromise;
  }

  // Generic database operations
  private async getTransaction(storeNames: string | string[], mode: IDBTransactionMode = "readonly") {
    const db = await this.initDB();
    return db.transaction(storeNames, mode);
  }

  private async getStore(storeName: string, mode: IDBTransactionMode = "readonly") {
    const transaction = await this.getTransaction(storeName, mode);
    return transaction.objectStore(storeName);
  }

  // Messages operations
  async saveMessage(message: Message): Promise<void> {
    const store = await this.getStore(STORES.MESSAGES, "readwrite");
    
    return new Promise((resolve, reject) => {
      const request = store.put(message);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

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
            resolve();
          }
        };
        request.onerror = () => {
          hasError = true;
          reject(request.error);
        };
      });

      if (messages.length === 0) {
        resolve();
      }
    });
  }

  async getMessagesByChatId(chatId: string): Promise<Message[]> {
    const store = await this.getStore(STORES.MESSAGES);
    
    return new Promise((resolve, reject) => {
      const messages: Message[] = [];
      const index = store.index("chat_id");
      const request = index.openCursor(IDBKeyRange.only(chatId));
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          messages.push(cursor.value);
          cursor.continue();
        } else {
          // Sort messages by created_at ascending
          messages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          resolve(messages);
        }
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  async getMessage(messageId: string): Promise<Message | null> {
    const store = await this.getStore(STORES.MESSAGES);
    
    return new Promise((resolve, reject) => {
      const request = store.get(messageId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async updateMessage(messageId: string, updates: Partial<Message>): Promise<void> {
    const store = await this.getStore(STORES.MESSAGES, "readwrite");
    
    return new Promise(async (resolve, reject) => {
      const getRequest = store.get(messageId);
      getRequest.onsuccess = () => {
        const existingMessage = getRequest.result;
        if (existingMessage) {
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

  async deleteMessage(messageId: string): Promise<void> {
    const store = await this.getStore(STORES.MESSAGES, "readwrite");
    
    return new Promise((resolve, reject) => {
      const request = store.delete(messageId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Chats operations
  async saveChat(chat: Chat): Promise<void> {
    const store = await this.getStore(STORES.CHATS, "readwrite");
    
    return new Promise((resolve, reject) => {
      const request = store.put(chat);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async saveChats(chats: Chat[]): Promise<void> {
    const store = await this.getStore(STORES.CHATS, "readwrite");
    
    return new Promise((resolve, reject) => {
      let completed = 0;
      let hasError = false;

      chats.forEach((chat) => {
        const request = store.put(chat);
        request.onsuccess = () => {
          completed++;
          if (completed === chats.length && !hasError) {
            resolve();
          }
        };
        request.onerror = () => {
          hasError = true;
          reject(request.error);
        };
      });

      if (chats.length === 0) {
        resolve();
      }
    });
  }

  async getChats(): Promise<Chat[]> {
    const store = await this.getStore(STORES.CHATS);
    
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const chats = request.result;
        // Sort by last_message_at descending
        chats.sort((a, b) => {
          const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
          const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
          return bTime - aTime;
        });
        resolve(chats);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getChat(chatId: string): Promise<Chat | null> {
    const store = await this.getStore(STORES.CHATS);
    
    return new Promise((resolve, reject) => {
      const request = store.get(chatId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async updateChat(chatId: string, updates: Partial<Chat>): Promise<void> {
    const store = await this.getStore(STORES.CHATS, "readwrite");
    
    return new Promise(async (resolve, reject) => {
      const getRequest = store.get(chatId);
      getRequest.onsuccess = () => {
        const existingChat = getRequest.result;
        if (existingChat) {
          const updatedChat = { ...existingChat, ...updates };
          const putRequest = store.put(updatedChat);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
        } else {
          reject(new Error("Chat not found"));
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  async deleteChat(chatId: string): Promise<void> {
    const transaction = await this.getTransaction([STORES.CHATS, STORES.MESSAGES, STORES.CHAT_PARTICIPANTS], "readwrite");
    
    return new Promise((resolve, reject) => {
      // Delete chat
      const chatStore = transaction.objectStore(STORES.CHATS);
      chatStore.delete(chatId);

      // Delete all messages in chat
      const messagesStore = transaction.objectStore(STORES.MESSAGES);
      const messagesIndex = messagesStore.index("chat_id");
      const messagesRequest = messagesIndex.openCursor(IDBKeyRange.only(chatId));
      
      messagesRequest.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };

      // Delete all chat participants
      const participantsStore = transaction.objectStore(STORES.CHAT_PARTICIPANTS);
      const participantsIndex = participantsStore.index("chat_id");
      const participantsRequest = participantsIndex.openCursor(IDBKeyRange.only(chatId));
      
      participantsRequest.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  // Profiles operations
  async saveProfile(profile: Profile): Promise<void> {
    const store = await this.getStore(STORES.PROFILES, "readwrite");
    
    return new Promise((resolve, reject) => {
      const request = store.put(profile);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async saveProfiles(profiles: Profile[]): Promise<void> {
    const store = await this.getStore(STORES.PROFILES, "readwrite");
    
    return new Promise((resolve, reject) => {
      let completed = 0;
      let hasError = false;

      profiles.forEach((profile) => {
        const request = store.put(profile);
        request.onsuccess = () => {
          completed++;
          if (completed === profiles.length && !hasError) {
            resolve();
          }
        };
        request.onerror = () => {
          hasError = true;
          reject(request.error);
        };
      });

      if (profiles.length === 0) {
        resolve();
      }
    });
  }

  async getProfile(profileId: string): Promise<Profile | null> {
    const store = await this.getStore(STORES.PROFILES);
    
    return new Promise((resolve, reject) => {
      const request = store.get(profileId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  // Chat participants operations
  async saveChatParticipant(participant: any): Promise<void> {
    const store = await this.getStore(STORES.CHAT_PARTICIPANTS, "readwrite");
    
    return new Promise((resolve, reject) => {
      const request = store.put(participant);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getChatParticipants(chatId: string): Promise<any[]> {
    const store = await this.getStore(STORES.CHAT_PARTICIPANTS);
    
    return new Promise((resolve, reject) => {
      const participants: any[] = [];
      const index = store.index("chat_id");
      const request = index.openCursor(IDBKeyRange.only(chatId));
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          participants.push(cursor.value);
          cursor.continue();
        } else {
          resolve(participants);
        }
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  // Sync status operations
  async getSyncStatus(type: SyncStatus['type']): Promise<SyncStatus | null> {
    const store = await this.getStore(STORES.SYNC_STATUS);
    
    return new Promise((resolve, reject) => {
      const request = store.get(type);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async updateSyncStatus(type: SyncStatus['type']): Promise<void> {
    const store = await this.getStore(STORES.SYNC_STATUS, "readwrite");
    
    return new Promise((resolve, reject) => {
      const syncStatus: SyncStatus = {
        id: type,
        type,
        lastSyncAt: new Date().toISOString(),
      };
      
      const request = store.put(syncStatus);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Utility methods
  async clearAllData(): Promise<void> {
    const transaction = await this.getTransaction(Object.values(STORES), "readwrite");
    
    return new Promise((resolve, reject) => {
      Object.values(STORES).forEach((storeName) => {
        const store = transaction.objectStore(storeName);
        store.clear();
      });

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

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

    // Estimate storage size (very rough approximation)
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
      const request = store.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Search operations
  async searchMessages(query: string, chatId?: string): Promise<Message[]> {
    const store = await this.getStore(STORES.MESSAGES);
    
    return new Promise((resolve, reject) => {
      const messages: Message[] = [];
      const request = store.openCursor();
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          const message = cursor.value;
          const matchesQuery = message.content.toLowerCase().includes(query.toLowerCase());
          const matchesChat = !chatId || message.chat_id === chatId;
          
          if (matchesQuery && matchesChat) {
            messages.push(message);
          }
          
          cursor.continue();
        } else {
          // Sort by created_at descending for search results
          messages.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          resolve(messages);
        }
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  // Close database connection
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.dbPromise = null;
    }
  }
}

// Export singleton instance
export const indexedDBService = new IndexedDBService();

// Export types for use in other files
export type { Message, Chat, Profile, SyncStatus }; 