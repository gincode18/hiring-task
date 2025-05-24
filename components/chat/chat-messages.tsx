"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/providers/auth-provider";
import { MessageBubble } from "@/components/chat/message-bubble";
import { Database } from "@/lib/database.types";
import { Spinner } from "@/components/ui/spinner";
import { format, isToday, isYesterday, isSameDay } from "date-fns";
import { useChatData, useOfflineSync } from "@/hooks/use-chat-data";
import { Badge } from "@/components/ui/badge";
import { AiOutlineWifi, AiOutlineSync } from "react-icons/ai";
import { type Message as IndexedDBMessage } from "@/lib/indexeddb";

type Message = Database["public"]["Tables"]["messages"]["Row"] & {
  profiles: Database["public"]["Tables"]["profiles"]["Row"];
};

interface ChatMessagesProps {
  chatId: string;
}

// Date separator component
function DateSeparator({ date }: { date: Date }) {
  const formatDate = (date: Date) => {
    if (isToday(date)) return "Today";
    if (isYesterday(date)) return "Yesterday";
    return format(date, "dd-MM-yyyy");
  };

  return (
    <div className="flex justify-center my-4">
      <div className="bg-gray-100 text-gray-600 text-xs px-3 py-1 rounded-full">
        {formatDate(date)}
      </div>
    </div>
  );
}

// Offline status indicator
function OfflineIndicator() {
  const { isOnline, pendingSync } = useOfflineSync();

  if (isOnline && !pendingSync) return null;

  return (
    <div className="flex items-center justify-center py-2 px-4 bg-yellow-50 border-b border-yellow-200">
      <div className="flex items-center gap-2 text-sm text-yellow-700">
        {!isOnline ? (
          <>
            <AiOutlineWifi className="h-4 w-4" />
            <span>You're offline. Messages will sync when online.</span>
          </>
        ) : pendingSync ? (
          <>
            <AiOutlineSync className="h-4 w-4 animate-spin" />
            <span>Syncing offline changes...</span>
          </>
        ) : null}
      </div>
    </div>
  );
}

export function ChatMessages({ chatId }: ChatMessagesProps) {
  const { user } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Use our new IndexedDB-powered hook
  const [{ messages: cachedMessages, loading, error, syncing }, { refreshFreshMessages, markMessagesAsRead }] = useChatData({
    chatId,
    autoSync: true,
    syncInterval: 30000, // Sync every 30 seconds
  });

  // Convert IndexedDB messages to the expected format
  // Handle cases where profiles might not be attached
  const messages: Message[] = cachedMessages.map(msg => {
    if (msg.profiles) {
      return {
        ...msg,
        profiles: msg.profiles
      } as Message;
    } else {
      // If no profile attached, create a fallback
      return {
        ...msg,
        profiles: {
          id: msg.user_id,
          email: '',
          full_name: 'Unknown User',
          avatar_url: null,
          phone_number: null,
          created_at: '',
          last_seen: null
        }
      } as Message;
    }
  });

  // Keep the original Supabase real-time subscription for immediate updates
  useEffect(() => {
    if (!chatId) return;

    // Subscribe to new messages and message updates
    const subscription = supabase
      .channel(`messages:${chatId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `chat_id=eq.${chatId}`,
        },
        async (payload) => {
          console.log("New message received via real-time, fetching fresh messages");
          // Fetch fresh messages from Supabase and update cache
          await refreshFreshMessages();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `chat_id=eq.${chatId}`,
        },
        async (payload) => {
          console.log("Message updated via real-time (read status/content change), fetching fresh messages");
          // Fetch fresh messages from Supabase and update cache for read status updates
          await refreshFreshMessages();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [chatId, refreshFreshMessages]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]); // Only trigger on message count change

  // Mark messages as read (optimized to not trigger refresh)
  useEffect(() => {
    const markAsRead = async () => {
      if (!user || messages.length === 0) return;

      // Only mark other people's messages as read
      const unreadMessages = messages.filter(
        (message) => !message.is_read && message.user_id !== user.id
      );

      if (unreadMessages.length > 0) {
        try {
          // Use the optimistic update method from the hook
          await markMessagesAsRead(unreadMessages.map(msg => msg.id));
          console.log("Messages marked as read using optimistic update");
        } catch (error) {
          console.error("Error marking messages as read:", error);
        }
      }
    };

    // Add a small delay to avoid marking messages as read too quickly
    const timeoutId = setTimeout(markAsRead, 1000);
    
    return () => clearTimeout(timeoutId);
  }, [messages.length, user, markMessagesAsRead]); // Use markMessagesAsRead instead of refreshFreshMessages

  // Group messages by date and render with separators
  const renderMessagesWithDateSeparators = () => {
    if (messages.length === 0) return null;

    const elements: React.ReactElement[] = [];
    let lastDate: Date | null = null;

    messages.forEach((message, index) => {
      const messageDate = new Date(message.created_at);
      
      // Add date separator if this is a new day
      if (!lastDate || !isSameDay(messageDate, lastDate)) {
        elements.push(
          <DateSeparator key={`date-${messageDate.toISOString()}`} date={messageDate} />
        );
        lastDate = messageDate;
      }

      // Add the message
      elements.push(
        <MessageBubble
          key={message.id}
          message={message}
          isOwn={message.user_id === user?.id}
        />
      );
    });

    return elements;
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-gray-50">
      {/* Offline status indicator */}
      <OfflineIndicator />
      
      {/* Sync status indicator */}
      {syncing && (
        <div className="flex items-center justify-center py-2 px-4 bg-blue-50 border-b border-blue-200">
          <div className="flex items-center gap-2 text-sm text-blue-700">
            <AiOutlineSync className="h-4 w-4 animate-spin" />
            <span>Syncing messages...</span>
          </div>
        </div>
      )}

      {/* Error indicator */}
      {error && (
        <div className="flex items-center justify-center py-2 px-4 bg-red-50 border-b border-red-200">
          <div className="text-sm text-red-700">
            {error}
          </div>
        </div>
      )}

      {/* Messages container */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Spinner />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center">
            <p className="text-gray-500">No messages yet</p>
            <p className="text-sm text-gray-400">Start the conversation by sending a message</p>
          </div>
        ) : (
          <>
            {renderMessagesWithDateSeparators()}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>
    </div>
  );
}