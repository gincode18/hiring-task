"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, Users, MessageSquare, X, Tag, User } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
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
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [chatType, setChatType] = useState<"dm" | "group">("dm");

  // Common predefined tags
  const commonTags = ["demo", "internal", "signup", "content", "support", "sales", "marketing"];

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

  // Reset selections when chat type changes
  useEffect(() => {
    if (chatType === "dm" && selectedUsers.length > 1) {
      setSelectedUsers([selectedUsers[0]]);
    }
    setChatName("");
  }, [chatType]);

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
        if (chatType === "dm") {
          // For DM, only allow one user
          return [user];
        } else {
          // For group, allow multiple
          return [...prev, user];
        }
      }
    });
  };

  const removeSelectedUser = (userId: string) => {
    setSelectedUsers(prev => prev.filter(u => u.id !== userId));
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => {
      const isSelected = prev.includes(tag);
      if (isSelected) {
        return prev.filter(t => t !== tag);
      } else {
        return [...prev, tag];
      }
    });
  };

  const removeTag = (tag: string) => {
    setSelectedTags(prev => prev.filter(t => t !== tag));
  };

  const addCustomTag = () => {
    if (customTag.trim() && !selectedTags.includes(customTag.trim())) {
      setSelectedTags(prev => [...prev, customTag.trim()]);
      setCustomTag("");
    }
  };

  const handleCustomTagKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addCustomTag();
    }
  };

  const createChat = async () => {
    if (!user || selectedUsers.length === 0) return;

    setIsCreating(true);
    try {
      const isGroupChat = chatType === "group";
      const finalChatName = isGroupChat 
        ? (chatName || `Group with ${selectedUsers.map(u => u.full_name).join(", ")}`)
        : null; // For DM, don't set a name - it will be derived from participants

      // Create the chat
      const { data: chat, error: chatError } = await supabase
        .from("chats")
        .insert({
          name: finalChatName,
          type: chatType === "dm" ? "direct" : "group",
          created_by: user.id,
          tags: selectedTags,
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
      setSelectedTags([]);
      setCustomTag("");
      setSearch("");
      setChatType("dm");

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
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Start New Conversation
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Chat Type Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Choose conversation type:</Label>
            <RadioGroup 
              value={chatType} 
              onValueChange={(value: "dm" | "group") => setChatType(value)}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="dm" id="dm" />
                <Label htmlFor="dm" className="flex items-center gap-2 cursor-pointer">
                  <User className="h-4 w-4" />
                  Direct Message
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="group" id="group" />
                <Label htmlFor="group" className="flex items-center gap-2 cursor-pointer">
                  <Users className="h-4 w-4" />
                  Group Chat
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Selected User/Users Display */}
          {selectedUsers.length > 0 && (
            <div className="space-y-3">
              {chatType === "dm" && selectedUsers.length === 1 ? (
                // DM: Show selected user prominently
                <Card className="border-green-200 bg-green-50">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12">
                        {selectedUsers[0].avatar_url && (
                          <AvatarImage 
                            src={selectedUsers[0].avatar_url} 
                            alt={selectedUsers[0].full_name}
                            className="object-cover"
                          />
                        )}
                        <AvatarFallback className="text-lg bg-green-100 text-green-700">
                          {getUserInitials(selectedUsers[0].full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="font-semibold text-green-900">
                          {selectedUsers[0].full_name}
                        </div>
                        <div className="text-sm text-green-700">
                          {selectedUsers[0].email}
                        </div>
                        <div className="text-xs text-green-600 mt-1">
                          Direct message with this person
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 hover:bg-green-200"
                        onClick={() => removeSelectedUser(selectedUsers[0].id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                // Group: Show multiple selected users
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    Selected members ({selectedUsers.length}):
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {selectedUsers.map((user) => (
                      <Card key={user.id} className="border-blue-200">
                        <CardContent className="p-2">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              {user.avatar_url && (
                                <AvatarImage 
                                  src={user.avatar_url} 
                                  alt={user.full_name}
                                  className="object-cover"
                                />
                              )}
                              <AvatarFallback className="text-xs">
                                {getUserInitials(user.full_name)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm font-medium truncate max-w-[100px]">
                              {user.full_name}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-4 w-4 p-0 hover:bg-red-100"
                              onClick={() => removeSelectedUser(user.id)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Group chat name (only show for group chats) */}
          {chatType === "group" && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Group name {selectedUsers.length > 0 ? "(optional)" : ""}:
              </Label>
              <Input
                placeholder="Enter group name..."
                value={chatName}
                onChange={(e) => setChatName(e.target.value)}
              />
              {selectedUsers.length > 0 && !chatName && (
                <p className="text-xs text-gray-500">
                  Default: Group with {selectedUsers.map(u => u.full_name).join(", ")}
                </p>
              )}
            </div>
          )}

          {/* Search users */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              {chatType === "dm" ? "Choose person to chat with:" : "Add members to group:"}
            </Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search users..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Users list */}
          <div className="max-h-48 overflow-y-auto space-y-1 border rounded-md p-2">
            {isLoading ? (
              <div className="text-center text-gray-500 py-4">Loading users...</div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center text-gray-500 py-4">
                {search ? "No users found" : "No other users available"}
              </div>
            ) : (
              filteredUsers.map((user) => {
                const isSelected = selectedUsers.some(u => u.id === user.id);
                const isDisabled = chatType === "dm" && selectedUsers.length > 0 && !isSelected;
                
                return (
                  <div
                    key={user.id}
                    className={`flex items-center gap-3 p-2 rounded-md transition-colors ${
                      isDisabled 
                        ? "opacity-50 cursor-not-allowed" 
                        : isSelected 
                          ? "bg-green-50 border border-green-200 cursor-pointer" 
                          : "hover:bg-gray-50 cursor-pointer"
                    }`}
                    onClick={() => !isDisabled && toggleUserSelection(user)}
                  >
                    <Avatar className="h-8 w-8">
                      {user.avatar_url && (
                        <AvatarImage 
                          src={user.avatar_url} 
                          alt={user.full_name}
                          className="object-cover"
                        />
                      )}
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

          {/* Tags section */}
          <div className="space-y-3">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Tags (optional)
            </Label>
            
            {/* Selected tags */}
            {selectedTags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedTags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="outline"
                    className="flex items-center gap-1 pr-1"
                  >
                    <span>{tag}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto p-0.5 hover:bg-destructive hover:text-destructive-foreground"
                      onClick={() => removeTag(tag)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            )}

            {/* Common tags */}
            <div className="space-y-2">
              <span className="text-xs text-gray-500">Common tags:</span>
              <div className="flex flex-wrap gap-2">
                {commonTags.map((tag) => {
                  const isSelected = selectedTags.includes(tag);
                  const getTagColor = (tag: string) => {
                    switch (tag.toLowerCase()) {
                      case 'demo':
                        return isSelected ? 'bg-orange-500 text-white' : 'bg-orange-100 text-orange-700 hover:bg-orange-200';
                      case 'internal':
                        return isSelected ? 'bg-green-500 text-white' : 'bg-green-100 text-green-700 hover:bg-green-200';
                      case 'signup':
                        return isSelected ? 'bg-blue-500 text-white' : 'bg-blue-100 text-blue-700 hover:bg-blue-200';
                      case 'content':
                        return isSelected ? 'bg-purple-500 text-white' : 'bg-purple-100 text-purple-700 hover:bg-purple-200';
                      case 'support':
                        return isSelected ? 'bg-red-500 text-white' : 'bg-red-100 text-red-700 hover:bg-red-200';
                      case 'sales':
                        return isSelected ? 'bg-yellow-500 text-white' : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200';
                      case 'marketing':
                        return isSelected ? 'bg-pink-500 text-white' : 'bg-pink-100 text-pink-700 hover:bg-pink-200';
                      default:
                        return isSelected ? 'bg-gray-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200';
                    }
                  };

                  return (
                    <Badge
                      key={tag}
                      variant="outline"
                      className={`cursor-pointer border-0 ${getTagColor(tag)}`}
                      onClick={() => toggleTag(tag)}
                    >
                      {tag}
                    </Badge>
                  );
                })}
              </div>
            </div>

            {/* Custom tag input */}
            <div className="flex gap-2">
              <Input
                placeholder="Add custom tag..."
                value={customTag}
                onChange={(e) => setCustomTag(e.target.value)}
                onKeyPress={handleCustomTagKeyPress}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addCustomTag}
                disabled={!customTag.trim() || selectedTags.includes(customTag.trim())}
              >
                Add
              </Button>
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
              {isCreating 
                ? "Creating..." 
                : `Create ${chatType === "dm" ? "Direct Message" : "Group Chat"}`
              }
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 