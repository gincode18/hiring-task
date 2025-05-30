"use client";

import { useRouter, usePathname } from "next/navigation";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { Database } from "@/lib/database.types";
import { format, isToday, isYesterday } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { AiOutlinePhone, AiOutlineCheck, AiOutlineCheckCircle } from "react-icons/ai";
import Image from "next/image";
import { useAuth } from "@/components/providers/auth-provider";
import { useOnlineStatus } from "@/hooks/use-chat-data";

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
  const { user } = useAuth();
  const { isUserOnlineById } = useOnlineStatus();
  const isActive = pathname === `/chat/${chat.id}`;

  // Get other participants (excluding current user)
  const otherParticipants = chat.chat_participants.filter(
    (participant) => participant.user_id !== user?.id
  );
  
  // Get last message
  const lastMessage = chat.messages.length > 0 
    ? chat.messages.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0] 
    : null;

  // Count unread messages from other users (not from current user)
  const unreadMessages = chat.messages.filter(
    (message) => 
      !message.is_read && 
      message.user_id !== user?.id // Only count messages from other users
  );
  const unreadCount = unreadMessages.length;

  // Get the most recent unread message for preview (if any)
  const latestUnreadMessage = unreadMessages.length > 0 
    ? unreadMessages.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
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

  // For direct messages, show only the other person's name
  // For group chats, use the chat name or show all other participants
  const isDM = chat.type === "direct";
  
  const chatName = isDM 
    ? (otherParticipants.length > 0 && otherParticipants[0].profiles?.full_name 
        ? otherParticipants[0].profiles.full_name 
        : "Unknown User")
    : (chat.name || otherParticipants.map(p => p.profiles?.full_name || "Unknown User").join(", "));

  // Get chat preview - prioritize unread messages, fall back to last message
  const getMessagePreview = (message: any) => {
    if (!message) return "No messages yet";
    
    if (message.type === 'attachment') {
      try {
        const attachmentData = JSON.parse(message.content);
        return `📎 ${attachmentData.fileName}`;
      } catch {
        return "📎 Attachment";
      }
    }
    
    return message.content;
  };

  const chatPreview = latestUnreadMessage 
    ? getMessagePreview(latestUnreadMessage)
    : (lastMessage ? getMessagePreview(lastMessage) : "No messages yet");

  // Get date display
  const dateDisplay = lastMessage ? formatMessageDate(lastMessage.created_at) : "";

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

  // Get avatar URL for DM (other person's avatar)
  const avatarUrl = isDM && otherParticipants.length > 0
    ? otherParticipants[0].profiles.avatar_url
    : null;

  // For direct messages, check if the other user is online
  const otherUser = isDM && otherParticipants.length > 0 ? otherParticipants[0] : null;
  const isOtherUserOnline = otherUser ? isUserOnlineById(otherUser.user_id) : false;

  // For group chats, check if any participants are online
  const hasOnlineParticipants = !isDM && otherParticipants.some(p => isUserOnlineById(p.user_id));
  const onlineParticipantsCount = !isDM ? otherParticipants.filter(p => isUserOnlineById(p.user_id)).length : 0;
  const shouldShowOnlineIndicator = isDM ? isOtherUserOnline : hasOnlineParticipants;

  return (
    <div
      className={cn(
        "flex cursor-pointer items-start px-4 py-3 transition-colors hover:bg-gray-50/80 border-b border-gray-50/50 relative",
        isActive && "bg-green-50/50 hover:bg-green-50/70 border-green-100/50",
        unreadCount > 0 && !isActive && "bg-blue-50/30 hover:bg-blue-50/50 border-blue-100/30"
      )}
      onClick={() => router.push(`/chat/${chat.id}`)}
    >
      {/* Active indicator */}
      {isActive && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-green-500 rounded-r-full" />
      )}

      {/* Avatar with profile picture or initials fallback */}
      <div className="relative">
        <Avatar className="h-12 w-12 shrink-0 border border-gray-200/50">
          {avatarUrl ? (
            <AvatarImage 
              src={avatarUrl} 
              alt={chatName}
              className="object-cover"
            />
          ) : (
            <AvatarImage 
              src="/periskope-icon.webp" 
              alt={chatName}
              className="object-cover"
            />
          )}
          <AvatarFallback className="bg-gradient-to-br from-green-400 to-green-600 text-white font-semibold text-sm">
            {getInitials(chatName)}
          </AvatarFallback>
        </Avatar>
        
        {/* Unread message indicator dot */}
        {unreadCount > 0 && (
          <div className="absolute -top-1 -right-1 h-4 w-4 bg-blue-500 border-2 border-white rounded-full flex items-center justify-center">
            <div className="h-2 w-2 bg-white rounded-full"></div>
          </div>
        )}
        
        {/* Online status indicator - only show if no unread messages */}
        {unreadCount === 0 && shouldShowOnlineIndicator && (
          <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 bg-green-500 border-2 border-white rounded-full" />
        )}
      </div>
      
      <div className="ml-3 flex-1 min-w-0">
        {/* Header Row */}
        <div className="flex items-start justify-between mb-1">
          <div className="flex items-center space-x-2 min-w-0 flex-1">
            <div className="flex items-center space-x-1.5">
              {isPhoneNumber && (
                <AiOutlinePhone className="h-3.5 w-3.5 text-gray-400 shrink-0" />
              )}
              <span className={cn(
                "text-gray-900 truncate text-[15px] leading-tight",
                unreadCount > 0 ? "font-bold" : "font-semibold"
              )}>
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
              <div className={cn(
                "flex items-center justify-center rounded-full text-[11px] font-semibold text-white shadow-sm min-w-[20px] px-1.5 py-0.5",
                unreadCount > 99 ? "bg-red-500" : "bg-blue-500"
              )}>
                {unreadCount > 99 ? "99+" : unreadCount}
              </div>
            )}
            <span className={cn(
              "text-[12px] whitespace-nowrap font-medium",
              unreadCount > 0 ? "text-gray-700" : "text-gray-500"
            )}>
              {dateDisplay}
            </span>
          </div>
        </div>
        
        {/* Message Preview Row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1.5 flex-1 mr-2">
            {lastMessage && lastMessage.user_id === user?.id && lastMessage.is_read && (
              <AiOutlineCheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />
            )}
            {lastMessage && lastMessage.user_id === user?.id && !lastMessage.is_read && (
              <AiOutlineCheck className="h-3.5 w-3.5 text-gray-400 shrink-0" />
            )}
            
            {/* Message preview with sender info for group chats */}
            <div className="flex-1 min-w-0">
              {latestUnreadMessage && !isDM && (
                <span className={cn(
                  "text-[12px] font-medium mr-1",
                  unreadCount > 0 ? "text-blue-600" : "text-gray-500"
                )}>
                  {otherParticipants.find(p => p.user_id === latestUnreadMessage.user_id)?.profiles?.full_name || "Unknown"}:
                </span>
              )}
              <span className={cn(
                "text-[13px] leading-relaxed",
                unreadCount > 0 ? "text-gray-900 font-medium" : "text-gray-600"
              )}>
                {chatPreview}
              </span>
              
              {/* Online status for group chats */}
              {!isDM && onlineParticipantsCount > 0 && (
                <span className="text-[11px] text-green-600 ml-2">
                  • {onlineParticipantsCount} online
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}