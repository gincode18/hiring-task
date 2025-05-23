"use client";

import { useState } from "react";
import {
  AiOutlineSmile,
  AiOutlinePaperClip,
  AiOutlineAudio,
  AiOutlineSend,
  AiOutlineSchedule,
  AiOutlineReload,
  AiOutlineStar,
  AiOutlineFileImage,
} from "react-icons/ai";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/providers/auth-provider";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
} from "@/components/ui/select";

interface ChatInputProps {
  chatId: string;
}

export function ChatInput({ chatId }: ChatInputProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<"whatsapp" | "private">(
    "whatsapp"
  );

  const handleSendMessage = async () => {
    if (!message.trim() || !user) return;

    setIsSubmitting(true);

    const { error } = await supabase.from("messages").insert({
      chat_id: chatId,
      user_id: user.id,
      content: message.trim(),
      type: "text",
    });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
      console.error("Error sending message:", error);
    } else {
      // Update last_message_at in chat
      await supabase
        .from("chats")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", chatId);

      setMessage("");
    }

    setIsSubmitting(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="border-t bg-white">
      {/* Tab Section */}
      <div className="flex items-center px-4 py-2 border-b border-gray-100">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1">
            <button
              onClick={() => setActiveTab("whatsapp")}
              className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                activeTab === "whatsapp"
                  ? "bg-green-100 text-green-800"
                  : "text-gray-600 hover:text-gray-800"
              }`}
            >
              WhatsApp
            </button>
          </div>

          <div className="flex items-center space-x-1">
            <button
              onClick={() => setActiveTab("private")}
              className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                activeTab === "private"
                  ? "bg-orange-100 text-orange-800"
                  : "text-gray-600 hover:text-gray-800"
              }`}
            >
              Private Note
            </button>
          </div>
        </div>
      </div>

      {/* Input Section */}
      <div className="p-4">
        {/* Message input row */}
        <div className="flex items-end space-x-2">
          <div className="flex-1 relative">
            <Textarea
              placeholder="Message..."
              className="min-h-10 max-h-32 resize-none border-gray-200 rounded-lg py-3 text-sm"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>
          <Button
            size="icon"
            className="shrink-0 h-9 w-9 rounded-full bg-green-600 hover:bg-green-700"
            onClick={handleSendMessage}
            disabled={isSubmitting}
          >
            <AiOutlineSend className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex justify-between mt-2">
          {/* Top row of action icons */}
          <div className="flex  space-x-2 items-center">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-gray-500 hover:bg-gray-100"
            >
              <AiOutlinePaperClip className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-gray-500 hover:bg-gray-100"
            >
              <AiOutlineSmile className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-gray-500 hover:bg-gray-100"
            >
              <AiOutlineSchedule className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-gray-500 hover:bg-gray-100"
            >
              <AiOutlineReload className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-gray-500 hover:bg-gray-100"
            >
              <AiOutlineStar className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-gray-500 hover:bg-gray-100"
            >
              <AiOutlineFileImage className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-gray-500 hover:bg-gray-100"
            >
              <AiOutlineAudio className="h-4 w-4" />
            </Button>
          </div>

          {/* Bottom branding */}
          <div className="flex justify-end">
            <div className="flex items-center space-x-2">
              <Select defaultValue="periskope">
                <SelectTrigger className="w-[180px] h-7">
                  <SelectValue placeholder="Select platform" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Platforms</SelectLabel>
                    <SelectItem value="periskope">
                      <div className="flex items-center space-x-1">
                        <div className="h-5 w-5 rounded-full bg-green-600 flex items-center justify-center">
                          <span className="text-white text-xs font-bold">
                            P
                          </span>
                        </div>
                        <span>Periskope</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="whatsapp">
                      <div className="flex items-center space-x-1">
                        <div className="h-5 w-5 rounded-full bg-green-600 flex items-center justify-center">
                          <span className="text-white text-xs font-bold">
                            W
                          </span>
                        </div>
                        <span>WhatsApp</span>
                      </div>
                    </SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
