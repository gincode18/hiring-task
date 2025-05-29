"use client";

import { useEffect, useState, useCallback } from "react";
import {
  AiOutlineFilter,
  AiOutlineSearch,
  AiOutlinePlus,
  AiOutlineClose,
} from "react-icons/ai";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { ChatItem } from "@/components/chat/chat-item";
import { NewChatDialog } from "@/components/chat/new-chat-dialog";
import { useAuth } from "@/components/providers/auth-provider";
import { supabase } from "@/lib/supabase";
import { Database } from "@/lib/database.types";
import { useChatData, useOfflineSync } from "@/hooks/use-chat-data";

type ChatWithParticipants = Database["public"]["Tables"]["chats"]["Row"] & {
  chat_participants: Array<{
    user_id: string;
    profiles: Database["public"]["Tables"]["profiles"]["Row"];
  }>;
  messages: Array<Database["public"]["Tables"]["messages"]["Row"]>;
};

export function ChatSidebar() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagSearch, setTagSearch] = useState("");
  const [showNewChatDialog, setShowNewChatDialog] = useState(false);
  const [showFilterDialog, setShowFilterDialog] = useState(false);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);

  // Use our new IndexedDB-powered hook for chats
  const [
    { chats: rawChats, loading, error, syncing },
    { refreshChats, refreshFreshChats, forceSync },
  ] = useChatData({
    autoSync: true,
    syncInterval: 30000, // Sync every 30 seconds
  });

  // Convert to the expected format with proper fallback handling
  const chats: ChatWithParticipants[] = rawChats.map((chat) => ({
    ...chat,
    chat_participants: (chat.chat_participants || []).map((participant) => ({
      user_id: participant.user_id,
      profiles: participant.profiles || {
        id: participant.user_id,
        email: "",
        full_name: "Unknown User",
        avatar_url: null,
        phone_number: null,
        created_at: "",
        last_seen: null,
      },
    })),
    messages: chat.messages || [],
  }));

  const { isOnline, pendingSync } = useOfflineSync();

  // Keep the original Supabase real-time subscription for immediate updates
  useEffect(() => {
    if (!user?.id) return;

    // Subscribe to new chats
    const chatSubscription = supabase
      .channel("chats-channel")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chats",
        },
        async () => {
          console.log("Chat change detected, refreshing chats");
          await refreshFreshChats();
        }
      )
      .subscribe();

    // Subscribe to chat participants changes (for group membership changes)
    const participantSubscription = supabase
      .channel("chat-participants-channel")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_participants",
        },
        async () => {
          console.log("Chat participant change detected, refreshing chats");
          await refreshFreshChats();
        }
      )
      .subscribe();

    // Subscribe to new messages to update chat list order
    const messageSubscription = supabase
      .channel("messages-channel")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        async () => {
          console.log("New message detected, refreshing chats for order update");
          await refreshFreshChats();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
        },
        async () => {
          console.log("Message updated (read status change), refreshing chats for unread count update");
          await refreshFreshChats();
        }
      )
      .subscribe();

    return () => {
      chatSubscription.unsubscribe();
      participantSubscription.unsubscribe();
      messageSubscription.unsubscribe();
    };
  }, [user?.id, refreshFreshChats]);

  // Get unique tags from all chats
  const availableTags = [
    ...new Set(chats.flatMap((chat) => chat.tags || [])),
  ].sort();

  const filteredChats = chats.filter((chat) => {
    // Filter by search term
    const searchMatch = !search
      ? true
      : chat.name?.toLowerCase().includes(search.toLowerCase()) ||
        chat.chat_participants?.some((participant) =>
          participant.profiles.full_name
            .toLowerCase()
            .includes(search.toLowerCase())
        );

    // Filter by custom filter (tags)
    const filterMatch = !selectedTags.length
      ? true
      : chat.tags && chat.tags.some((tag) => selectedTags.includes(tag));

    return searchMatch && filterMatch;
  });

  return (
    <div className="flex h-full w-80 flex-col bg-white border-r border-gray-100 relative">
      {/* Header with Custom Filter, Save, Search, and Filtered */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
        <div className="flex items-center space-x-1 flex-1 min-w-0">
          <Dialog open={showFilterDialog} onOpenChange={setShowFilterDialog}>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="px-2 py-1 text-xs font-medium text-green-600 hover:bg-green-50 flex items-center gap-1 h-7 shrink-0"
              >
                <AiOutlineFilter className="h-3 w-3" />
                Custom filter
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] max-h-[600px] flex flex-col">
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold">
                  Advanced Filters
                </DialogTitle>
              </DialogHeader>

              <div className="flex-1 overflow-hidden flex flex-col gap-6 py-4">
                {/* Search by Name Section */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">
                    Search by Name
                  </h4>
                  <div className="relative">
                    <AiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search chats and participants..."
                      className="pl-10 border-gray-200 focus:border-green-300 focus:ring-green-200"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                </div>

                <Separator />

                {/* Tag Filters Section */}
                <div className="flex-1 overflow-hidden flex flex-col">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-gray-900">
                      Filter by Tags
                    </h4>
                    {selectedTags.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-gray-500 hover:text-gray-700 h-auto p-1"
                        onClick={() => setSelectedTags([])}
                      >
                        Clear all
                      </Button>
                    )}
                  </div>

                  {/* Tag Search */}
                  <div className="relative mb-4">
                    <AiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search tags..."
                      className="pl-10 border-gray-200 focus:border-green-300 focus:ring-green-200"
                      value={tagSearch}
                      onChange={(e) => setTagSearch(e.target.value)}
                    />
                    {tagSearch && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
                        onClick={() => setTagSearch("")}
                      >
                        <AiOutlineClose className="h-3 w-3" />
                      </Button>
                    )}
                  </div>

                  {/* Selected Tags Display */}
                  {selectedTags.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs text-gray-500 mb-2">
                        Selected ({selectedTags.length}):
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {selectedTags.map((tag) => {
                          const getTagColor = (tag: string) => {
                            const colors = [
                              "bg-blue-100 text-blue-800 border-blue-200",
                              "bg-green-100 text-green-800 border-green-200",
                              "bg-yellow-100 text-yellow-800 border-yellow-200",
                              "bg-purple-100 text-purple-800 border-purple-200",
                              "bg-pink-100 text-pink-800 border-pink-200",
                              "bg-indigo-100 text-indigo-800 border-indigo-200",
                            ];
                            const index = tag
                              .split("")
                              .reduce(
                                (acc, char) => acc + char.charCodeAt(0),
                                0
                              );
                            return colors[index % colors.length];
                          };

                          return (
                            <Badge
                              key={tag}
                              variant="outline"
                              className={`text-xs border ${getTagColor(
                                tag
                              )} cursor-pointer`}
                              onClick={() =>
                                setSelectedTags(
                                  selectedTags.filter((t) => t !== tag)
                                )
                              }
                            >
                              {tag}
                              <AiOutlineClose className="h-3 w-3 ml-1 hover:bg-black/10 rounded" />
                            </Badge>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Available Tags */}
                  <div className="flex-1 overflow-y-auto">
                    <div className="space-y-2">
                      {availableTags
                        .filter(
                          (tag) =>
                            !selectedTags.includes(tag) &&
                            (!tagSearch ||
                              tag
                                .toLowerCase()
                                .includes(tagSearch.toLowerCase()))
                        )
                        .map((tag) => {
                          const getTagColor = (tag: string) => {
                            const colors = [
                              "bg-blue-100 text-blue-800 border-blue-200",
                              "bg-green-100 text-green-800 border-green-200",
                              "bg-yellow-100 text-yellow-800 border-yellow-200",
                              "bg-purple-100 text-purple-800 border-purple-200",
                              "bg-pink-100 text-pink-800 border-pink-200",
                              "bg-indigo-100 text-indigo-800 border-indigo-200",
                            ];
                            const index = tag
                              .split("")
                              .reduce(
                                (acc, char) => acc + char.charCodeAt(0),
                                0
                              );
                            return colors[index % colors.length];
                          };

                          return (
                            <div
                              key={tag}
                              className="flex items-center space-x-2"
                            >
                              <Checkbox
                                id={tag}
                                checked={selectedTags.includes(tag)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setSelectedTags([...selectedTags, tag]);
                                  } else {
                                    setSelectedTags(
                                      selectedTags.filter((t) => t !== tag)
                                    );
                                  }
                                }}
                                className="border-gray-300 data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
                              />
                              <Badge
                                variant="outline"
                                className={`text-xs border cursor-pointer flex-1 justify-start ${getTagColor(
                                  tag
                                )}`}
                                onClick={() => {
                                  if (!selectedTags.includes(tag)) {
                                    setSelectedTags([...selectedTags, tag]);
                                  }
                                }}
                              >
                                {tag}
                              </Badge>
                            </div>
                          );
                        })}
                    </div>

                    {availableTags.length === 0 && (
                      <p className="text-sm text-gray-500 text-center py-4">
                        No tags available
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Button
            variant="ghost"
            size="sm"
            className="px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 flex items-center gap-1 h-7 shrink-0"
          >
            Save
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className={`px-2 py-1 text-xs font-medium flex items-center gap-1 h-7 transition-colors shrink-0 ${
              isSearchExpanded
                ? "text-green-600 bg-green-50 hover:bg-green-100"
                : "text-gray-600 hover:bg-gray-50"
            }`}
            onClick={() => setIsSearchExpanded(!isSearchExpanded)}
          >
            <AiOutlineSearch className="h-3 w-3" />
            Search
          </Button>

          {/* Show filtered indicator when filters are active */}
          {(selectedTags.length > 0 || search) && (
            <Badge
              variant="outline"
              className="text-xs bg-green-50 text-green-700 border-green-200 shrink-0"
            >
              Filtered ({filteredChats.length})
            </Badge>
          )}
        </div>

        <div className="flex items-center space-x-2 ml-2">
          {/* Sync status indicator */}
          {syncing && (
            <div className="text-xs text-blue-600 whitespace-nowrap">
              Syncing...
            </div>
          )}

          {/* Offline indicator */}
          {!isOnline && (
            <div className="text-xs text-yellow-600 whitespace-nowrap">
              Offline
            </div>
          )}
        </div>
      </div>

      {/* Search Input (expandable) */}
      {isSearchExpanded && (
        <div className="px-3 py-2 border-b border-gray-100">
          <div className="relative">
            <AiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search chats..."
              className="pl-10 text-sm border-gray-200 focus:border-green-300 focus:ring-green-200"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
                onClick={() => setSearch("")}
              >
                <AiOutlineClose className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Chats List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="text-sm text-gray-500">Loading chats...</div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-32 px-4">
            <div className="text-sm text-red-600 text-center mb-2">{error}</div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => forceSync()}
              className="text-xs"
            >
              Retry
            </Button>
          </div>
        ) : filteredChats.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 space-y-3">
            <div className="text-sm text-gray-500">
              {search || selectedTags.length > 0
                ? "No chats found"
                : "No chats yet"}
            </div>
            {!search && selectedTags.length === 0 && (
              <Button
                onClick={() => setShowNewChatDialog(true)}
                className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2"
                size="sm"
              >
                <AiOutlinePlus className="h-4 w-4" />
                Start Your First Chat
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-1 p-2">
            {filteredChats.map((chat) => (
              <ChatItem key={chat.id} chat={chat} />
            ))}
          </div>
        )}
      </div>

      {/* New Chat Dialog */}
      <NewChatDialog
        open={showNewChatDialog}
        onOpenChange={setShowNewChatDialog}
        onChatCreated={refreshFreshChats}
      />

      {/* Floating Action Button for New Chat */}
      <Button
        onClick={() => setShowNewChatDialog(true)}
        className="absolute bottom-6 right-6 h-14 w-14 rounded-full bg-green-600 hover:bg-green-700 shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 z-10"
        title="Start new conversation"
      >
        <AiOutlinePlus className="h-6 w-6 text-white" />
      </Button>
    </div>
  );
}
