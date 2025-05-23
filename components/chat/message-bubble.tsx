import { format } from "date-fns";
import { Check, CheckCheck } from "lucide-react";
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
        "mb-4 flex",
        isOwn ? "justify-end" : "justify-start"
      )}
    >
      {!isOwn && (
        <Avatar
          className="mr-2 h-8 w-8 self-end"
          // fallback={message.profiles.full_name.charAt(0)}
        />
      )}
      <div
        className={cn(
          "relative max-w-md rounded-lg px-4 py-2",
          isOwn
            ? "rounded-br-none bg-green-100 text-gray-800"
            : "rounded-bl-none bg-white text-gray-800"
        )}
      >
        {!isOwn && (
          <div className="mb-1 text-xs font-medium text-green-600">
            {message.profiles.full_name}
          </div>
        )}
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
        <div
          className={cn(
            "mt-1 flex items-center justify-end space-x-1",
            isOwn ? "text-gray-500" : "text-gray-400"
          )}
        >
          <span className="text-xs">{formattedTime}</span>
          {isOwn && (
            <>
              {message.is_read ? (
                <CheckCheck className="h-3 w-3 text-green-500" />
              ) : (
                <Check className="h-3 w-3" />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}