import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AiOutlineSearch,
  AiOutlinePhone,
  AiOutlineMore,
} from "react-icons/ai";
import { HiMiniSparkles } from "react-icons/hi2";
import { Badge } from "@/components/ui/badge";
import { Database } from "@/lib/database.types";
import { useAuth } from "@/components/providers/auth-provider";

type ChatWithParticipants = Database["public"]["Tables"]["chats"]["Row"] & {
  chat_participants: Array<{
    user_id: string;
    profiles: Database["public"]["Tables"]["profiles"]["Row"];
  }>;
};

interface ChatHeaderProps {
  chat: ChatWithParticipants;
}

export function ChatHeader({ chat }: ChatHeaderProps) {
  const { user } = useAuth();
  
  // Get other participants (excluding current user)
  const otherParticipants = chat.chat_participants.filter(
    (participant) => participant.user_id !== user?.id
  );

  // For direct messages, show only the other person's name
  // For group chats, use the chat name or show all other participants
  const isDM = chat.type === "direct";
  
  const chatName = isDM 
    ? (otherParticipants.length > 0 ? otherParticipants[0].profiles.full_name : "Unknown User")
    : (chat.name || otherParticipants.map((p) => p.profiles.full_name).join(", "));

  const participantsString = isDM
    ? (otherParticipants.length > 0 ? otherParticipants[0].profiles.email || "" : "")
    : otherParticipants.map((p) => p.profiles.full_name).join(", ");

  // Get initials for avatar fallback
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(word => word.charAt(0))
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // For DM, use the other person's avatar, for group use a group avatar
  const avatarFallback = isDM && otherParticipants.length > 0
    ? getInitials(otherParticipants[0].profiles.full_name)
    : getInitials(chatName);

  // Get avatar URL for DM (other person's avatar)
  const avatarUrl = isDM && otherParticipants.length > 0
    ? otherParticipants[0].profiles.avatar_url
    : null;

  return (
    <div className="flex items-center justify-between border-b bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center space-x-3">
        <Avatar className="h-10 w-10 bg-gray-200">
          {avatarUrl && (
            <AvatarImage src={avatarUrl} alt={chatName} className="object-cover" />
          )}
          <AvatarFallback className="bg-gradient-to-br from-green-400 to-green-600 text-white font-semibold">
            {avatarFallback}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2">
            <h2 className="font-semibold text-gray-900 text-base truncate">
              {chatName}
            </h2>
          </div>
          <p className="text-sm text-gray-500 truncate">{participantsString}</p>
        </div>
      </div>

      <div className="flex items-center space-x-1">
        {/* Participant Avatars - only show for group chats or if there are multiple participants */}
        {(!isDM || otherParticipants.length > 1) && (
          <div className="flex items-center -space-x-2 mr-2">
            {otherParticipants.slice(0, 4).map((participant, index) => (
              <Avatar
                key={participant.user_id}
                className="h-8 w-8 border-2 border-white bg-gray-200"
                style={{ zIndex: otherParticipants.length - index }}
              >
                {participant.profiles.avatar_url && (
                  <AvatarImage 
                    src={participant.profiles.avatar_url} 
                    alt={participant.profiles.full_name}
                    className="object-cover"
                  />
                )}
                <AvatarFallback className="text-xs bg-gray-300">
                  {getInitials(participant.profiles.full_name)}
                </AvatarFallback>
              </Avatar>
            ))}
            {otherParticipants.length > 4 && (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-300 border-2 border-white text-xs font-medium text-gray-600">
                +{otherParticipants.length - 4}
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-gray-500 hover:bg-gray-100"
        >
          <HiMiniSparkles className="h-5 w-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-gray-500 hover:bg-gray-100"
        >
          <AiOutlineSearch className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
