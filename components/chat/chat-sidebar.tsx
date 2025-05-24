"use client";

import { useEffect, useState, useCallback } from "react";
import { AiOutlineFilter, AiOutlineSearch, AiOutlinePlus } from "react-icons/ai";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ChatItem } from "@/components/chat/chat-item";
import { NewChatDialog } from "@/components/chat/new-chat-dialog";
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
  const [showNewChatDialog, setShowNewChatDialog] = useState(false);
  const [showFilterDialog, setShowFilterDialog] = useState(false);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);

  const fetchChats = useCallback(async () => {
    if (!user) return;

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
  }, [user]);

  useEffect(() => {
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
          filter: `chat_participants.user_id=eq.${user?.id}`,
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
  }, [fetchChats]);

  // Get unique tags from all chats
  const availableTags = [...new Set(chats.flatMap(chat => chat.tags || []))].sort();

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

    // Filter by custom filter (tags)
    const filterMatch = !filter
      ? true
      : chat.tags && chat.tags.some(tag => tag.toLowerCase() === filter.toLowerCase());

    return searchMatch && filterMatch;
  });

  return (
    <div className="flex h-full w-80 flex-col bg-white border-r border-gray-100 relative">
      {/* Header with Custom Filter, Save, Search, and Filtered */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
        <div className="flex items-center space-x-2">
          <Dialog open={showFilterDialog} onOpenChange={setShowFilterDialog}>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="px-2 py-1 text-xs font-medium text-green-600 hover:bg-green-50 flex items-center gap-1 h-7"
              >
                <AiOutlineFilter className="h-3 w-3" />
                Custom filter
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Custom Filters</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="flex flex-wrap gap-2">
                  <Badge
                    variant={!filter ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => {
                      setFilter("");
                      setShowFilterDialog(false);
                    }}
                  >
                    All
                  </Badge>
                  {availableTags.map((tag) => {
                    const getTagColor = (tag: string) => {
                      switch (tag.toLowerCase()) {
                        case 'demo':
                          return 'bg-orange-100 text-orange-700 hover:bg-orange-200';
                        case 'internal':
                          return 'bg-green-100 text-green-700 hover:bg-green-200';
                        case 'signup':
                          return 'bg-blue-100 text-blue-700 hover:bg-blue-200';
                        case 'content':
                          return 'bg-purple-100 text-purple-700 hover:bg-purple-200';
                        default:
                          return 'bg-gray-100 text-gray-700 hover:bg-gray-200';
                      }
                    };

                    return (
                      <Badge
                        key={tag}
                        variant={filter === tag ? "default" : "outline"}
                        className={`cursor-pointer ${filter !== tag ? getTagColor(tag) : ''}`}
                        onClick={() => {
                          setFilter(tag);
                          setShowFilterDialog(false);
                        }}
                      >
                        {tag}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            </DialogContent>
          </Dialog>
          
          <Button
            variant="ghost"
            size="sm"
            className="px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-50 h-7"
          >
            Save
          </Button>
        </div>

        <div className="flex items-center space-x-2">
          <div className={`relative transition-all duration-200 ${
            isSearchExpanded ? "w-40" : "w-8"
          }`}>
            {isSearchExpanded ? (
              <Input
                placeholder="Search"
                className="h-7 text-xs pl-8 pr-3 border-gray-200 focus:border-green-300 focus:ring-green-200"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onBlur={() => !search && setIsSearchExpanded(false)}
                autoFocus
              />
            ) : null}
            <AiOutlineSearch 
              className={`h-4 w-4 text-gray-400 cursor-pointer transition-all duration-200 ${
                isSearchExpanded 
                  ? "absolute left-2 top-1/2 -translate-y-1/2" 
                  : "hover:text-gray-600"
              }`}
              onClick={() => setIsSearchExpanded(true)}
            />
          </div>

          {filter && (
            <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 h-6 px-2">
              Filtered
            </Badge>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-gray-400 hover:bg-gray-50 hover:text-gray-600"
            onClick={() => setShowFilterDialog(true)}
          >
            <AiOutlineFilter className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto">
        {filteredChats.map((chat) => (
          <ChatItem key={chat.id} chat={chat} />
        ))}
      </div>

      {/* Floating New Chat Button */}
      <div className="absolute bottom-4 right-4">
        <Button
          onClick={() => setShowNewChatDialog(true)}
          className="h-12 w-12 rounded-full bg-green-500 hover:bg-green-600 shadow-lg flex items-center justify-center p-0"
        >
          <AiOutlinePlus className="h-6 w-6 text-white" />
        </Button>
      </div>

      <NewChatDialog 
        open={showNewChatDialog} 
        onOpenChange={setShowNewChatDialog}
        onChatCreated={fetchChats}
      />
    </div>
  );
}