"use client";

import { useRouter, usePathname } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { Database } from "@/lib/database.types";
import { format, isToday, isYesterday } from "date-fns";
import { Badge } from "@/components/ui/badge";

type ChatWithParticipants = Database["public"]["Tables"]["chats"]["Row"] & {
  chat_participants: Array<{
    user_id: string;
    profiles: Database["public"]["Tables"]["profiles"]["Row"];
  }>;
  messages: Array<Database["public"]["Tables"]["messages"]["Row"]>;
};

interface ChatItemProps {
  chat: ChatWithParticipants;
}

export function ChatItem({ chat }: ChatItemProps) {
  const router = useRouter();
  const pathname = usePathname();
  const isActive = pathname === `/chat/${chat.id}`;

  // Get other participants (excluding current user)
  const participants = chat.chat_participants;
  
  // Get last message
  const lastMessage = chat.messages.length > 0 
    ? chat.messages.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0] 
    : null;

  // Format date for display
  const formatMessageDate = (date: string) => {
    const messageDate = new Date(date);
    
    if (isToday(messageDate)) {
      return format(messageDate, "HH:mm");
    }
    
    if (isYesterday(messageDate)) {
      return "Yesterday";
    }
    
    return format(messageDate, "dd-MM-yyyy");
  };

  // Get chat name
  const chatName = chat.name || participants.map(p => p.profiles.full_name).join(", ");

  // Get chat preview
  const chatPreview = lastMessage ? lastMessage.content : "No messages yet";

  // Get date display
  const dateDisplay = lastMessage ? formatMessageDate(lastMessage.created_at) : "";

  return (
    <div
      className={cn(
        "flex cursor-pointer items-center border-b p-4 transition-colors hover:bg-gray-50",
        isActive && "bg-gray-100 hover:bg-gray-100"
      )}
      onClick={() => router.push(`/chat/${chat.id}`)}
    >
      <Avatar className="h-10 w-10 shrink-0" />
      <div className="ml-4 flex-1 overflow-hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <span className="font-medium">{chatName}</span>
            <div className="ml-2 flex space-x-1">
              {chat.is_demo && (
                <Badge variant="outline" className="px-1 py-0 text-xs">
                  Demo
                </Badge>
              )}
              {chat.is_internal && (
                <Badge variant="outline" className="px-1 py-0 text-xs">
                  Internal
                </Badge>
              )}
              {chat.is_signup && (
                <Badge variant="outline" className="px-1 py-0 text-xs">
                  Signup
                </Badge>
              )}
              {chat.is_content && (
                <Badge variant="outline" className="px-1 py-0 text-xs">
                  Content
                </Badge>
              )}
            </div>
          </div>
          <span className="text-xs text-gray-500">{dateDisplay}</span>
        </div>
        <div className="mt-1 flex items-center justify-between">
          <p className="truncate text-sm text-gray-500">{chatPreview}</p>
          {lastMessage && !lastMessage.is_read && (
            <span className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-xs text-white">
              1
            </span>
          )}
        </div>
      </div>
    </div>
  );
}