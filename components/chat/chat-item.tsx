"use client";

import { useRouter, usePathname } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { Database } from "@/lib/database.types";
import { format, isToday, isYesterday } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { AiOutlinePhone, AiOutlineCheck, AiOutlineCheckCircle } from "react-icons/ai";

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
    
    return format(messageDate, "dd-MMM-yy");
  };

  // Get chat name
  const chatName = chat.name || participants.map(p => p.profiles.full_name).join(", ");

  // Get chat preview
  const chatPreview = lastMessage ? lastMessage.content : "No messages yet";

  // Get date display
  const dateDisplay = lastMessage ? formatMessageDate(lastMessage.created_at) : "";

  // Get unread count (mock for now)
  const unreadCount = lastMessage && !lastMessage.is_read ? 1 : 0;

  // Check if this is a phone number
  const isPhoneNumber = /^\+?[\d\s-()]+$/.test(chatName);

  return (
    <div
      className={cn(
        "flex cursor-pointer items-start px-4 py-3 transition-colors hover:bg-gray-50 border-b border-gray-50",
        isActive && "bg-blue-50 hover:bg-blue-50 border-blue-100"
      )}
      onClick={() => router.push(`/chat/${chat.id}`)}
    >
      <Avatar className="h-12 w-12 shrink-0 bg-gray-200" />
      
      <div className="ml-3 flex-1 min-w-0">
        {/* Header Row */}
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center space-x-2 min-w-0 flex-1">
            <div className="flex items-center space-x-1">
              {isPhoneNumber && (
                <AiOutlinePhone className="h-3 w-3 text-gray-400 shrink-0" />
              )}
              <span className="font-semibold text-gray-900 truncate text-sm">
                {chatName}
              </span>
            </div>
            <div className="flex items-center space-x-1 shrink-0">
              {chat.is_demo && (
                <Badge variant="secondary" className="px-2 py-0.5 text-xs bg-orange-100 text-orange-700 border-0">
                  Demo
                </Badge>
              )}
              {chat.is_internal && (
                <Badge variant="secondary" className="px-2 py-0.5 text-xs bg-green-100 text-green-700 border-0">
                  internal
                </Badge>
              )}
              {chat.is_signup && (
                <Badge variant="secondary" className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 border-0">
                  Signup
                </Badge>
              )}
              {chat.is_content && (
                <Badge variant="secondary" className="px-2 py-0.5 text-xs bg-purple-100 text-purple-700 border-0">
                  Content
                </Badge>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-2 shrink-0 ml-2">
            {unreadCount > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-xs font-medium text-white">
                {unreadCount}
              </span>
            )}
            <span className="text-xs text-gray-500 whitespace-nowrap">
              {dateDisplay}
            </span>
          </div>
        </div>
        
        {/* Message Preview Row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1 flex-1 mr-2">
            {lastMessage && lastMessage.is_read && (
              <AiOutlineCheck className="h-3 w-3 text-green-500 shrink-0" />
            )}
            <p className="text-sm text-gray-600 truncate">
              {chatPreview}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}