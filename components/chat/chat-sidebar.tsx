"use client";

import { useEffect, useState, useCallback } from "react";
import { AiOutlineFilter, AiOutlineSearch, AiOutlinePlus, AiOutlineClose } from "react-icons/ai";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
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
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagSearch, setTagSearch] = useState("");
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
    const filterMatch = !selectedTags.length
      ? true
      : chat.tags && chat.tags.some(tag => selectedTags.includes(tag));

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
            <DialogContent className="sm:max-w-[500px] max-h-[600px] flex flex-col">
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold">Advanced Filters</DialogTitle>
              </DialogHeader>
              
              <div className="flex-1 overflow-hidden flex flex-col gap-6 py-4">
                {/* Search by Name Section */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">Search by Name</h4>
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
                    <h4 className="text-sm font-semibold text-gray-900">Filter by Tags</h4>
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
                      <p className="text-xs text-gray-500 mb-2">Selected ({selectedTags.length}):</p>
                      <div className="flex flex-wrap gap-1">
                        {selectedTags.map((tag) => {
                          const getTagColor = (tag: string) => {
                            switch (tag.toLowerCase()) {
                              case 'demo':
                                return 'bg-orange-100 text-orange-700 border-orange-200';
                              case 'internal':
                                return 'bg-green-100 text-green-700 border-green-200';
                              case 'signup':
                                return 'bg-blue-100 text-blue-700 border-blue-200';
                              case 'content':
                                return 'bg-purple-100 text-purple-700 border-purple-200';
                              default:
                                return 'bg-gray-100 text-gray-700 border-gray-200';
                            }
                          };

                          return (
                            <Badge
                              key={tag}
                              variant="outline"
                              className={`px-2 py-1 text-xs cursor-pointer border ${getTagColor(tag)} hover:opacity-80`}
                              onClick={() => setSelectedTags(selectedTags.filter(t => t !== tag))}
                            >
                              {tag}
                              <AiOutlineClose className="ml-1 h-3 w-3" />
                            </Badge>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Available Tags List */}
                  <div className="flex-1 overflow-y-auto">
                    <p className="text-xs text-gray-500 mb-2">Available tags:</p>
                    <div className="space-y-2">
                      {availableTags
                        .filter(tag => 
                          !tagSearch || tag.toLowerCase().includes(tagSearch.toLowerCase())
                        )
                        .map((tag) => {
                          const isSelected = selectedTags.includes(tag);
                          const getTagColor = (tag: string) => {
                            switch (tag.toLowerCase()) {
                              case 'demo':
                                return 'bg-orange-50 border-orange-200 text-orange-700';
                              case 'internal':
                                return 'bg-green-50 border-green-200 text-green-700';
                              case 'signup':
                                return 'bg-blue-50 border-blue-200 text-blue-700';
                              case 'content':
                                return 'bg-purple-50 border-purple-200 text-purple-700';
                              default:
                                return 'bg-gray-50 border-gray-200 text-gray-700';
                            }
                          };

                          return (
                            <div
                              key={tag}
                              className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-colors hover:bg-opacity-80 ${
                                isSelected 
                                  ? getTagColor(tag)
                                  : 'bg-white border-gray-200 hover:bg-gray-50'
                              }`}
                              onClick={() => {
                                if (isSelected) {
                                  setSelectedTags(selectedTags.filter(t => t !== tag));
                                } else {
                                  setSelectedTags([...selectedTags, tag]);
                                }
                              }}
                            >
                              <Checkbox
                                checked={isSelected}
                                onChange={() => {}}
                                className="data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
                              />
                              <span className="text-sm font-medium flex-1">{tag}</span>
                              <span className="text-xs text-gray-500">
                                {chats.filter(chat => chat.tags?.includes(tag)).length}
                              </span>
                            </div>
                          );
                        })}
                    </div>

                    {tagSearch && availableTags.filter(tag => 
                      tag.toLowerCase().includes(tagSearch.toLowerCase())
                    ).length === 0 && (
                      <div className="text-center py-4">
                        <p className="text-sm text-gray-500">No tags found matching "{tagSearch}"</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                <div className="text-xs text-gray-500">
                  {filteredChats.length} of {chats.length} chats
                </div>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearch("");
                      setSelectedTags([]);
                      setTagSearch("");
                    }}
                  >
                    Reset
                  </Button>
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => setShowFilterDialog(false)}
                  >
                    Apply Filters
                  </Button>
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

          {selectedTags.length > 0 && (
            <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 h-6 px-2">
              {selectedTags.length} selected
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