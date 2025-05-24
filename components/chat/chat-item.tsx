"use client";

import { useRouter, usePathname } from "next/navigation";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { Database } from "@/lib/database.types";
import { format, isToday, isYesterday } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { AiOutlinePhone, AiOutlineCheck, AiOutlineCheckCircle } from "react-icons/ai";
import Image from "next/image";

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

  // Get initials for avatar fallback
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(word => word.charAt(0))
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div
      className={cn(
        "flex cursor-pointer items-start px-4 py-3 transition-colors hover:bg-gray-50/80 border-b border-gray-50/50 relative",
        isActive && "bg-green-50/50 hover:bg-green-50/70 border-green-100/50"
      )}
      onClick={() => router.push(`/chat/${chat.id}`)}
    >
      {/* Active indicator */}
      {isActive && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-green-500 rounded-r-full" />
      )}

      {/* Avatar with Periskope logo for business contacts */}
      <div className="relative">
        <Avatar className="h-12 w-12 shrink-0 border border-gray-200/50">
          <AvatarImage 
            src="/periskope-icon.webp" 
            alt={chatName}
            className="object-cover"
          />
          <AvatarFallback className="bg-gradient-to-br from-green-400 to-green-600 text-white font-semibold text-sm">
            {getInitials(chatName)}
          </AvatarFallback>
        </Avatar>
        
        {/* Online status indicator */}
        <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 bg-green-500 border-2 border-white rounded-full" />
      </div>
      
      <div className="ml-3 flex-1 min-w-0">
        {/* Header Row */}
        <div className="flex items-start justify-between mb-1">
          <div className="flex items-center space-x-2 min-w-0 flex-1">
            <div className="flex items-center space-x-1.5">
              {isPhoneNumber && (
                <AiOutlinePhone className="h-3.5 w-3.5 text-gray-400 shrink-0" />
              )}
              <span className="font-semibold text-gray-900 truncate text-[15px] leading-tight">
                {chatName}
              </span>
            </div>
            
            {/* Tags */}
            {chat.tags && chat.tags.length > 0 && (
              <div className="flex items-center space-x-1 shrink-0">
                {chat.tags.slice(0, 2).map((tag) => {
                  const getTagColor = (tag: string) => {
                    switch (tag.toLowerCase()) {
                      case 'demo':
                        return 'bg-orange-100 text-orange-700 border-orange-200';
                      case 'internal':
                        return 'bg-green-100 text-green-700 border-green-200';
                      case 'signup':
                        return 'bg-blue-100 text-blue-700 border-blue-200';
                      case 'content':
                        return 'bg-purple-100 text-purple-700 border-purple-200';
                      case 'support':
                        return 'bg-red-100 text-red-700 border-red-200';
                      case 'sales':
                        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
                      case 'marketing':
                        return 'bg-pink-100 text-pink-700 border-pink-200';
                      default:
                        return 'bg-green-100 text-green-700 border-green-200';
                    }
                  };

                  return (
                    <Badge 
                      key={tag} 
                      variant="outline" 
                      className={`px-1.5 py-0.5 text-[10px] font-medium border ${getTagColor(tag)} rounded-md`}
                    >
                      {tag}
                    </Badge>
                  );
                })}
                {chat.tags.length > 2 && (
                  <Badge 
                    variant="outline" 
                    className="px-1.5 py-0.5 text-[10px] font-medium border bg-gray-100 text-gray-600 border-gray-200 rounded-md"
                  >
                    +{chat.tags.length - 2}
                  </Badge>
                )}
              </div>
            )}
          </div>
          
          {/* Time and unread count */}
          <div className="flex items-center space-x-2 shrink-0 ml-2">
            {unreadCount > 0 && (
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-[11px] font-semibold text-white shadow-sm">
                {unreadCount}
              </div>
            )}
            <span className="text-[12px] text-gray-500 whitespace-nowrap font-medium">
              {dateDisplay}
            </span>
          </div>
        </div>
        
        {/* Message Preview Row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1.5 flex-1 mr-2">
            {lastMessage && lastMessage.is_read && (
              <AiOutlineCheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />
            )}
            <p className="text-[13px] text-gray-600 truncate leading-relaxed">
              {chatPreview}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}