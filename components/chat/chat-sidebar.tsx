"use client";

import { useEffect, useState } from "react";
import { Filter, Search, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChatItem } from "@/components/chat/chat-item";
import { useAuth } from "@/components/providers/auth-provider";
import { supabase } from "@/lib/supabase";
import { Database } from "@/lib/database.types";

type ChatWithParticipants = Database["public"]["Tables"]["chats"]["Row"] & {
  chat_participants: Array<{
    user_id: string;
    profiles: Database["public"]["Tables"]["profiles"]["Row"];
  }>;
  messages: Array<Database["public"]["Tables"]["messages"]["Row"]>;
};

export function ChatSidebar() {
  const { user } = useAuth();
  const [chats, setChats] = useState<ChatWithParticipants[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");

  useEffect(() => {
    if (!user) return;

    const fetchChats = async () => {
      const { data, error } = await supabase
        .from("chats")
        .select(`
          *,
          chat_participants!inner(user_id, profiles(*)),
          messages(*)
        `)
        .eq("chat_participants.user_id", user.id)
        .order("last_message_at", { ascending: false });

      if (error) {
        console.error("Error fetching chats:", error);
        return;
      }

      setChats(data as ChatWithParticipants[]);
    };

    fetchChats();

    // Subscribe to new chats
    const chatSubscription = supabase
      .channel("chats-channel")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chats",
          filter: `chat_participants.user_id=eq.${user.id}`,
        },
        () => {
          fetchChats();
        }
      )
      .subscribe();

    // Subscribe to new messages
    const messageSubscription = supabase
      .channel("messages-channel")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
        },
        () => {
          fetchChats();
        }
      )
      .subscribe();

    return () => {
      chatSubscription.unsubscribe();
      messageSubscription.unsubscribe();
    };
  }, [user]);

  const filteredChats = chats.filter((chat) => {
    // Filter by search term
    const searchMatch = !search
      ? true
      : chat.name?.toLowerCase().includes(search.toLowerCase()) ||
        chat.chat_participants.some((participant) =>
          participant.profiles.full_name
            .toLowerCase()
            .includes(search.toLowerCase())
        );

    // Filter by custom filter
    const filterMatch = !filter
      ? true
      : (filter === "demo" && chat.is_demo) ||
        (filter === "internal" && chat.is_internal) ||
        (filter === "signup" && chat.is_signup) ||
        (filter === "content" && chat.is_content);

    return searchMatch && filterMatch;
  });

  return (
    <div className="flex h-full w-80 flex-col border-r">
      <div className="flex items-center justify-between border-b p-3">
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            className="px-2 text-xs font-medium text-green-600"
          >
            <Filter className="mr-1 h-3 w-3" />
            Custom filter
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="px-2 text-xs font-medium text-gray-500"
          >
            Save
          </Button>
        </div>
      </div>
      <div className="flex items-center border-b p-3">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search"
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="ml-2 shrink-0 text-gray-500"
        >
          <Filter className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div className="flex space-x-1">
          <Badge
            variant={!filter ? "default" : "outline"}
            className="cursor-pointer bg-green-600 hover:bg-green-700"
            onClick={() => setFilter("")}
          >
            All
          </Badge>
          <Badge
            variant={filter === "demo" ? "default" : "outline"}
            className="cursor-pointer bg-green-600 hover:bg-green-700"
            onClick={() => setFilter("demo")}
          >
            Demo
          </Badge>
          <Badge
            variant={filter === "internal" ? "default" : "outline"}
            className="cursor-pointer bg-green-600 hover:bg-green-700"
            onClick={() => setFilter("internal")}
          >
            Internal
          </Badge>
          <Badge
            variant={filter === "signup" ? "default" : "outline"}
            className="cursor-pointer bg-green-600 hover:bg-green-700"
            onClick={() => setFilter("signup")}
          >
            Signup
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 text-gray-500"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {filteredChats.map((chat) => (
          <ChatItem key={chat.id} chat={chat} />
        ))}
      </div>
    </div>
  );
}