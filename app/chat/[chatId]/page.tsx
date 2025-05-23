import { ChatHeader } from "@/components/chat/chat-header";
import { ChatMessages } from "@/components/chat/chat-messages";
import { ChatInput } from "@/components/chat/chat-input";
import { supabase } from "@/lib/supabase";
import { notFound } from "next/navigation";

interface ChatPageProps {
  params: {
    chatId: string;
  };
}

export default async function ChatPage({ params }: ChatPageProps) {
  const { data: chat, error } = await supabase
    .from("chats")
    .select("*, chat_participants!inner(user_id, profiles(*))")
    .eq("id", params.chatId)
    .single();

  if (error || !chat) {
    notFound();
  }

  return (
    <div className="flex flex-1 flex-col">
      <ChatHeader chat={chat} />
      <ChatMessages chatId={params.chatId} />
      <ChatInput chatId={params.chatId} />
    </div>
  );
}