"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/providers/auth-provider";
import { MessageBubble } from "@/components/chat/message-bubble";
import { Database } from "@/lib/database.types";
import { Spinner } from "@/components/ui/spinner";

type Message = Database["public"]["Tables"]["messages"]["Row"] & {
  profiles: Database["public"]["Tables"]["profiles"]["Row"];
};

interface ChatMessagesProps {
  chatId: string;
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

    // Subscribe to new messages
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
        const { error } = await supabase
          .from("messages")
          .update({ is_read: true, read_at: new Date().toISOString() })
          .in(
            "id",
            unreadMessages.map((message) => message.id)
          );

        if (error) {
          console.error("Error marking messages as read:", error);
        }
      }
    };

    markAsRead();
  }, [messages, user]);

  return (
    <div className="flex flex-1 flex-col overflow-y-auto bg-gray-50 p-4">
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
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              isOwn={message.user_id === user?.id}
            />
          ))}
          <div ref={messagesEndRef} />
        </>
      )}
    </div>
  );
}