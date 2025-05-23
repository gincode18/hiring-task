"use client";

import { useState } from "react";
import {
  Smile,
  Paperclip,
  Mic,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/providers/auth-provider";
import { useToast } from "@/hooks/use-toast";

interface ChatInputProps {
  chatId: string;
}

export function ChatInput({ chatId }: ChatInputProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    <div className="border-t bg-white p-4">
      <div className="flex items-end space-x-2">
        <Button variant="ghost" size="icon" className="shrink-0">
          <Smile className="h-5 w-5 text-gray-500" />
        </Button>
        <Button variant="ghost" size="icon" className="shrink-0">
          <Paperclip className="h-5 w-5 text-gray-500" />
        </Button>
        <Textarea
          placeholder="Type a message..."
          className="min-h-10 max-h-32 resize-none"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        {message.trim() ? (
          <Button
            size="icon"
            className="shrink-0 rounded-full bg-green-600 hover:bg-green-700"
            onClick={handleSendMessage}
            disabled={isSubmitting}
          >
            <Send className="h-5 w-5" />
          </Button>
        ) : (
          <Button variant="ghost" size="icon" className="shrink-0">
            <Mic className="h-5 w-5 text-gray-500" />
          </Button>
        )}
      </div>
    </div>
  );
}