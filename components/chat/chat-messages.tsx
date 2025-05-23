"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/providers/auth-provider";
import { MessageBubble } from "@/components/chat/message-bubble";
import { Database } from "@/lib/database.types";
import { Spinner } from "@/components/ui/spinner";
import { format, isToday, isYesterday, isSameDay } from "date-fns";

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

export function ChatMessages({ chatId }: ChatMessagesProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchMessages = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("messages")
        .select("*, profiles(*)")
        .eq("chat_id", chatId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error fetching messages:", error);
      } else {
        setMessages(data as Message[]);
      }
      setLoading(false);
    };

    fetchMessages();

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
          // Fetch the complete message with profile data
          const { data, error } = await supabase
            .from("messages")
            .select("*, profiles(*)")
            .eq("id", payload.new.id)
            .single();

          if (!error && data) {
            setMessages((current) => [...current, data as Message]);
          }
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
        (payload) => {
          // Update existing message in the list
          console.log("Message updated:", payload.new);
          setMessages((current) =>
            current.map((message) => {
              if (message.id === payload.new.id) {
                return {
                  ...message,
                  is_read: payload.new.is_read,
                  read_at: payload.new.read_at,
                  content: payload.new.content,
                };
              }
              return message;
            })
          );
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [chatId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Mark messages as read
  useEffect(() => {
    const markAsRead = async () => {
      if (!user) return;

      // Only mark other people's messages as read
      const unreadMessages = messages.filter(
        (message) => !message.is_read && message.user_id !== user.id
      );

      if (unreadMessages.length > 0) {
        console.log(`Marking ${unreadMessages.length} messages as read...`);
        
        const { data, error } = await supabase
          .from("messages")
          .update({ is_read: true, read_at: new Date().toISOString() })
          .in(
            "id",
            unreadMessages.map((message) => message.id)
          )
          .select("id, is_read, read_at");

        if (error) {
          console.error("Error marking messages as read:", error);
          console.error("Error details:", {
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint
          });
        } else {
          console.log("Successfully marked messages as read:", data);
          
          // Update local state to reflect the changes
          setMessages(currentMessages => 
            currentMessages.map(message => {
              const updatedMessage = data?.find(d => d.id === message.id);
              if (updatedMessage) {
                return {
                  ...message,
                  is_read: updatedMessage.is_read,
                  read_at: updatedMessage.read_at
                };
              }
              return message;
            })
          );
        }
      }
    };

    // Add a small delay to avoid marking messages as read too quickly
    const timeoutId = setTimeout(markAsRead, 1000);
    
    return () => clearTimeout(timeoutId);
  }, [messages, user]);

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
    <div className="flex flex-1 flex-col overflow-y-auto bg-gray-50 px-4 py-6">
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
  );
}