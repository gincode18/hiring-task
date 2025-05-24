import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import {
  AiOutlineSearch,
  AiOutlinePhone,
  AiOutlineMore,
} from "react-icons/ai";
import { HiMiniSparkles } from "react-icons/hi2";
import { Badge } from "@/components/ui/badge";
import { Database } from "@/lib/database.types";

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
  const chatName =
    chat.name || participants.map((p) => p.profiles.full_name).join(", ");
  const participantsString = participants
    .map((p) => p.profiles.full_name)
    .join(", ");

  return (
    <div className="flex items-center justify-between border-b bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center space-x-3">
        <Avatar className="h-10 w-10 bg-gray-200" />
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
        {/* Participant Avatars */}
        <div className="flex items-center -space-x-2 mr-2">
          {participants.slice(0, 4).map((participant, index) => (
            <Avatar
              key={participant.user_id}
              className="h-8 w-8 border-2 border-white bg-gray-200"
              style={{ zIndex: participants.length - index }}
            />
          ))}
          {participants.length > 4 && (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-300 border-2 border-white text-xs font-medium text-gray-600">
              +{participants.length - 4}
            </div>
          )}
        </div>

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
