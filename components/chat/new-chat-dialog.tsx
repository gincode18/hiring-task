"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, Users, MessageSquare, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/components/providers/auth-provider";
import { supabase } from "@/lib/supabase";
import { Database } from "@/lib/database.types";
import { useToast } from "@/hooks/use-toast";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

interface NewChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChatCreated?: () => void;
}

export function NewChatDialog({ open, onOpenChange, onChatCreated }: NewChatDialogProps) {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [users, setUsers] = useState<Profile[]>([]);
  const [search, setSearch] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<Profile[]>([]);
  const [chatName, setChatName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!open || !user) return;

    const fetchUsers = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .neq("id", user.id)
        .order("full_name");

      if (error) {
        console.error("Error fetching users:", error);
        toast({
          title: "Error",
          description: "Failed to load users",
          variant: "destructive",
        });
      } else {
        setUsers(data || []);
      }
      setIsLoading(false);
    };

    fetchUsers();
  }, [open, user, toast]);

  const filteredUsers = users.filter((u) =>
    u.full_name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const toggleUserSelection = (user: Profile) => {
    setSelectedUsers(prev => {
      const isSelected = prev.some(u => u.id === user.id);
      if (isSelected) {
        return prev.filter(u => u.id !== user.id);
      } else {
        return [...prev, user];
      }
    });
  };

  const removeSelectedUser = (userId: string) => {
    setSelectedUsers(prev => prev.filter(u => u.id !== userId));
  };

  const createChat = async () => {
    if (!user || selectedUsers.length === 0) return;

    setIsCreating(true);
    try {
      const isGroupChat = selectedUsers.length > 1;
      const chatType = isGroupChat ? "group" : "direct";
      const finalChatName = isGroupChat ? (chatName || `Group with ${selectedUsers.map(u => u.full_name).join(", ")}`) : null;

      // Create the chat
      const { data: chat, error: chatError } = await supabase
        .from("chats")
        .insert({
          name: finalChatName,
          type: chatType,
          created_by: user.id,
          is_demo: false,
          is_internal: false,
          is_signup: false,
          is_content: false,
        })
        .select()
        .single();

      if (chatError) throw chatError;

      // Add current user as admin
      const participants = [
        {
          chat_id: chat.id,
          user_id: user.id,
          role: "admin",
        },
        // Add selected users as members
        ...selectedUsers.map(u => ({
          chat_id: chat.id,
          user_id: u.id,
          role: "member" as const,
        }))
      ];

      const { error: participantsError } = await supabase
        .from("chat_participants")
        .insert(participants);

      if (participantsError) throw participantsError;

      toast({
        title: "Success",
        description: `${isGroupChat ? "Group chat" : "Direct message"} created successfully`,
      });

      onOpenChange(false);
      onChatCreated?.();
      router.push(`/chat/${chat.id}`);

      // Reset form
      setSelectedUsers([]);
      setChatName("");
      setSearch("");

    } catch (error) {
      console.error("Error creating chat:", error);
      toast({
        title: "Error",
        description: "Failed to create chat",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const getUserInitials = (name: string) => {
    return name
      .split(" ")
      .map(n => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Start New Conversation
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search users */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Selected users */}
          {selectedUsers.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Selected users:</label>
              <div className="flex flex-wrap gap-2">
                {selectedUsers.map((user) => (
                  <Badge
                    key={user.id}
                    variant="outline"
                    className="flex items-center gap-1 pr-1"
                  >
                    <span className="truncate max-w-[100px]">{user.full_name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto p-0.5 hover:bg-destructive hover:text-destructive-foreground"
                      onClick={() => removeSelectedUser(user.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Group chat name (only show if multiple users selected) */}
          {selectedUsers.length > 1 && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Group name (optional):</label>
              <Input
                placeholder="Enter group name..."
                value={chatName}
                onChange={(e) => setChatName(e.target.value)}
              />
            </div>
          )}

          {/* Users list */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Choose users to chat with:</label>
            <div className="max-h-60 overflow-y-auto space-y-1 border rounded-md p-2">
              {isLoading ? (
                <div className="text-center text-gray-500 py-4">Loading users...</div>
              ) : filteredUsers.length === 0 ? (
                <div className="text-center text-gray-500 py-4">
                  {search ? "No users found" : "No other users available"}
                </div>
              ) : (
                filteredUsers.map((user) => {
                  const isSelected = selectedUsers.some(u => u.id === user.id);
                  return (
                    <div
                      key={user.id}
                      className={`flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors ${
                        isSelected 
                          ? "bg-green-50 border border-green-200" 
                          : "hover:bg-gray-50"
                      }`}
                      onClick={() => toggleUserSelection(user)}
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs">
                          {getUserInitials(user.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">
                          {user.full_name}
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          {user.email}
                        </div>
                      </div>
                      {isSelected && (
                        <div className="text-green-600">
                          ✓
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button
              onClick={createChat}
              disabled={selectedUsers.length === 0 || isCreating}
              className="bg-green-600 hover:bg-green-700"
            >
              {isCreating ? "Creating..." : `Create ${selectedUsers.length > 1 ? "Group" : "Chat"}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 