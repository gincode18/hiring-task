import { format } from "date-fns";
import { AiOutlineCheck } from "react-icons/ai";
import { Avatar } from "@/components/ui/avatar";
import { Database } from "@/lib/database.types";
import { cn } from "@/lib/utils";

type Message = Database["public"]["Tables"]["messages"]["Row"] & {
  profiles: Database["public"]["Tables"]["profiles"]["Row"];
};

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
}

export function MessageBubble({ message, isOwn }: MessageBubbleProps) {
  const formattedTime = format(new Date(message.created_at), "HH:mm");

  return (
    <div
      className={cn(
        "mb-3 flex",
        isOwn ? "justify-end" : "justify-start"
      )}
    >
      {!isOwn && (
        <Avatar
          className="mr-3 h-10 w-10 self-start mt-1 bg-gray-200"
        />
      )}
      <div className={cn("flex flex-col", isOwn ? "items-end" : "items-start")}>
        {!isOwn && (
          <div className="mb-1 text-sm font-semibold text-green-600">
            {message.profiles.full_name}
          </div>
        )}
        <div
          className={cn(
            "relative max-w-md rounded-lg px-3 py-2 shadow-sm",
            isOwn
              ? "bg-green-500 text-white rounded-br-sm"
              : "bg-white text-gray-800 border border-gray-200 rounded-bl-sm"
          )}
        >
          <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
          <div
            className={cn(
              "mt-1 flex items-center justify-end space-x-1 text-xs",
              isOwn ? "text-green-100" : "text-gray-500"
            )}
          >
            <span>{formattedTime}</span>
            {isOwn && (
              <div className="flex">
                <AiOutlineCheck className={cn("h-3 w-3", message.is_read ? "text-blue-200" : "text-green-200")} />
                {message.is_read && (
                  <AiOutlineCheck className="h-3 w-3 text-blue-200 -ml-1.5" />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}