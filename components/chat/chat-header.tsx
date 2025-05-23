import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import {
  Search,
  Phone,
  MoreVertical,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Database } from "@/lib/database.types";
import { AvatarGroup } from "@/components/ui/avatar-group";

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
  // Get other participants (excluding current user)
  const participants = chat.chat_participants;
  
  // Get chat name and participants string
  const chatName = chat.name || participants.map(p => p.profiles.full_name).join(", ");
  const participantsString = participants.map(p => p.profiles.full_name).join(", ");

  return (
    <div className="flex items-center justify-between border-b bg-white p-4">
      <div className="flex items-center">
        {chat.type === "group" ? (
          <AvatarGroup
            items={participants.map((participant) => ({
              name: participant.profiles.full_name,
              image: participant.profiles.avatar_url,
            }))}
            limit={3}
          />
        ) : (
          <Avatar className="h-10 w-10" />
        )}
        <div className="ml-4">
          <div className="flex items-center">
            <h2 className="font-medium">{chatName}</h2>
            <div className="ml-2 flex space-x-1">
              {chat.is_demo && (
                <Badge variant="outline" className="px-1 py-0 text-xs">
                  Demo
                </Badge>
              )}
              {chat.is_internal && (
                <Badge variant="outline" className="px-1 py-0 text-xs text-blue-500 border-blue-200">
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
          <p className="text-sm text-gray-500">{participantsString}</p>
        </div>
      </div>
      <div className="flex items-center space-x-2">
        <Button variant="ghost" size="icon">
          <Search className="h-5 w-5 text-gray-500" />
        </Button>
        <Button variant="ghost" size="icon">
          <Phone className="h-5 w-5 text-gray-500" />
        </Button>
        <Button variant="ghost" size="icon">
          <Users className="h-5 w-5 text-gray-500" />
        </Button>
        <Button variant="ghost" size="icon">
          <MoreVertical className="h-5 w-5 text-gray-500" />
        </Button>
      </div>
    </div>
  );
}