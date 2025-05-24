"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { Database } from "@/lib/database.types";

type ChatWithParticipants = Database["public"]["Tables"]["chats"]["Row"] & {
  chat_participants: Array<{
    user_id: string;
    profiles: Database["public"]["Tables"]["profiles"]["Row"];
  }>;
};

interface ChatContextType {
  selectedChat: ChatWithParticipants | null;
  setSelectedChat: (chat: ChatWithParticipants | null) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [selectedChat, setSelectedChat] = useState<ChatWithParticipants | null>(null);

  return (
    <ChatContext.Provider
      value={{
        selectedChat,
        setSelectedChat,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
} 