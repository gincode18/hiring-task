"use client";

import { useEffect, useState } from "react";
import { use } from "react";
import { ChatHeader } from "@/components/chat/chat-header";
import { ChatMessages } from "@/components/chat/chat-messages";
import { ChatInput } from "@/components/chat/chat-input";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/providers/auth-provider";
import { useChat } from "@/components/providers/chat-provider";
import { useRouter } from "next/navigation";
import { Database } from "@/lib/database.types";
import { Spinner } from "@/components/ui/spinner";

type ChatWithParticipants = Database["public"]["Tables"]["chats"]["Row"] & {
  chat_participants: Array<{
    user_id: string;
    profiles: Database["public"]["Tables"]["profiles"]["Row"];
  }>;
};

interface ChatPageProps {
  params: Promise<{
    chatId: string;
  }>;
}

export default function ChatPage({ params }: ChatPageProps) {
  const { user, isLoading: authLoading } = useAuth();
  const { setSelectedChat } = useChat();
  const router = useRouter();
  const [chat, setChat] = useState<ChatWithParticipants | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Unwrap the params Promise
  const { chatId } = use(params);

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      router.push("/login");
      return;
    }

    const fetchChat = async () => {
      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from("chats")
          .select("*, chat_participants!inner(user_id, profiles(*))")
          .eq("id", chatId)
          .single();

        if (error) {
          console.log("Error fetching chat:", error);
          return;
        }

        // Check if user is a participant in this chat
        const isParticipant = data.chat_participants.some(
          (participant: { user_id: string; profiles: Database["public"]["Tables"]["profiles"]["Row"] }) => 
            participant.user_id === user.id
        );

        if (!isParticipant) {
          setError("You don't have access to this chat");
          return;
        }

        setChat(data);
        setSelectedChat(data); // Set the selected chat in context
      } catch (err) {
        console.error("Unexpected error:", err);
        setError("Failed to load chat");
      } finally {
        setIsLoading(false);
      }
    };

    fetchChat();
  }, [chatId, user, authLoading, router, setSelectedChat]);

  // Clean up selected chat when leaving the page
  useEffect(() => {
    return () => {
      setSelectedChat(null);
    };
  }, [setSelectedChat]);

  if (authLoading || isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-gray-900">Chat not found</h2>
          <p className="mt-2 text-gray-600">{error}</p>
          <button
            onClick={() => router.push("/chat")}
            className="mt-4 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            Back to Chats
          </button>
        </div>
      </div>
    );
  }

  if (!chat) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-gray-900">Chat not found</h2>
          <p className="mt-2 text-gray-600">This chat may have been deleted or you don't have access to it.</p>
          <button
            onClick={() => router.push("/chat")}
            className="mt-4 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            Back to Chats
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <ChatHeader chat={chat} />
      <ChatMessages chatId={chatId} />
      <ChatInput chatId={chatId} />
    </div>
  );
}