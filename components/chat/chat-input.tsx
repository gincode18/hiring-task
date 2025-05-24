"use client";

import { useState, useRef } from "react";
import {
  AiOutlineSmile,
  AiOutlinePaperClip,
  AiOutlineAudio,
  AiOutlineSend,
  AiOutlineSchedule,
  AiOutlineReload,
  AiOutlineStar,
  AiOutlineFileImage,
  AiOutlineClose,
  AiOutlineFile,
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

interface AttachmentFile {
  file: File;
  id: string;
  preview?: string;
}

export function ChatInput({ chatId }: ChatInputProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<"whatsapp" | "private">(
    "whatsapp"
  );
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const compressImage = (file: File, maxWidth = 1920, quality = 0.8): Promise<File> => {
    return new Promise((resolve) => {
      if (!file.type.startsWith('image/')) {
        resolve(file);
        return;
      }

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        // Calculate new dimensions
        let { width, height } = img;
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        // Draw and compress
        ctx?.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: file.type,
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              resolve(file);
            }
          },
          file.type,
          quality
        );
      };

      img.src = URL.createObjectURL(file);
    });
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    processFiles(files);
  };

  const processFiles = (files: File[]) => {
    files.forEach((file) => {
      // Check file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please select files smaller than 10MB",
          variant: "destructive",
        });
        return;
      }

      const attachmentId = Math.random().toString(36).substring(7);
      let preview: string | undefined;

      // Create preview for images
      if (file.type.startsWith("image/")) {
        preview = URL.createObjectURL(file);
      }

      setAttachments((prev) => [
        ...prev,
        { file, id: attachmentId, preview },
      ]);
    });

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    processFiles(files);
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => {
      const attachment = prev.find((att) => att.id === id);
      if (attachment?.preview) {
        URL.revokeObjectURL(attachment.preview);
      }
      return prev.filter((att) => att.id !== id);
    });
  };

  const uploadFileToSupabase = async (file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `chat-attachments/${chatId}/${fileName}`;

      const { data, error } = await supabase.storage
        .from("attachments")
        .upload(filePath, file);

      if (error) {
        console.error("Upload error:", error);
        return null;
      }

      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from("attachments")
        .getPublicUrl(filePath);

      return publicUrlData.publicUrl;
    } catch (error) {
      console.error("Upload error:", error);
      return null;
    }
  };

  const handleSendMessage = async () => {
    if ((!message.trim() && attachments.length === 0) || !user) return;

    setIsSubmitting(true);
    setIsUploading(true);

    try {
      // Handle attachments first
      if (attachments.length > 0) {
        for (const attachment of attachments) {
          const compressedFile = await compressImage(attachment.file);
          const fileUrl = await uploadFileToSupabase(compressedFile);
          
          if (!fileUrl) {
            toast({
              title: "Upload failed",
              description: `Failed to upload ${attachment.file.name}`,
              variant: "destructive",
            });
            continue;
          }

          // Create attachment message
          const attachmentContent = JSON.stringify({
            fileName: attachment.file.name,
            fileUrl,
            fileSize: compressedFile.size,
            fileType: compressedFile.type,
            originalSize: attachment.file.size,
          });

          const { error: attachmentError } = await supabase
            .from("messages")
            .insert({
              chat_id: chatId,
              user_id: user.id,
              content: attachmentContent,
              type: "attachment",
            });

          if (attachmentError) {
            console.error("Error sending attachment:", attachmentError);
            toast({
              title: "Error",
              description: `Failed to send ${attachment.file.name}`,
              variant: "destructive",
            });
          }
        }

        // Clear attachments
        attachments.forEach((att) => {
          if (att.preview) {
            URL.revokeObjectURL(att.preview);
          }
        });
        setAttachments([]);
      }

      // Handle text message
      if (message.trim()) {
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
          setMessage("");
        }
      }

      // Update last_message_at in chat
      await supabase
        .from("chats")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", chatId);

    } catch (error) {
      console.error("Error in handleSendMessage:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
      setIsUploading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith("image/")) {
      return <AiOutlineFileImage className="h-4 w-4" />;
    }
    if (fileType.startsWith("video/")) {
      return <AiOutlineFile className="h-4 w-4" />;
    }
    if (fileType.startsWith("audio/")) {
      return <AiOutlineAudio className="h-4 w-4" />;
    }
    return <AiOutlineFile className="h-4 w-4" />;
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

      {/* Attachment Preview */}
      {attachments.length > 0 && (
        <div className="px-4 py-2 border-b border-gray-100">
          <div className="flex flex-wrap gap-2">
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="relative bg-gray-50 rounded-lg p-2 flex items-center space-x-2 max-w-xs"
              >
                {attachment.preview ? (
                  <img
                    src={attachment.preview}
                    alt={attachment.file.name}
                    className="w-10 h-10 object-cover rounded"
                  />
                ) : (
                  <div className="w-10 h-10 bg-gray-200 rounded flex items-center justify-center">
                    {getFileIcon(attachment.file.type)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-700 truncate">
                    {attachment.file.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {(attachment.file.size / 1024 / 1024).toFixed(1)} MB
                  </p>
                </div>
                <button
                  onClick={() => removeAttachment(attachment.id)}
                  className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600"
                >
                  <AiOutlineClose className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input Section */}
      <div 
        className={`p-4 relative ${isDragOver ? 'bg-blue-50 border-blue-200' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Drag overlay */}
        {isDragOver && (
          <div className="absolute inset-0 bg-blue-100 bg-opacity-75 border-2 border-dashed border-blue-400 rounded-lg flex items-center justify-center z-10">
            <div className="text-center">
              <AiOutlinePaperClip className="h-8 w-8 text-blue-600 mx-auto mb-2" />
              <p className="text-blue-700 font-medium">Drop files here to upload</p>
            </div>
          </div>
        )}
        
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
            {isUploading ? (
              <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <AiOutlineSend className="h-5 w-5" />
            )}
          </Button>
        </div>

        <div className="flex justify-between mt-2">
          {/* Top row of action icons */}
          <div className="flex  space-x-2 items-center">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
              onChange={handleFileSelect}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className="hidden"
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-gray-500 hover:bg-gray-100"
              onClick={() => fileInputRef.current?.click()}
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
              onClick={() => {
                if (fileInputRef.current) {
                  fileInputRef.current.accept = "image/*";
                  fileInputRef.current.click();
                }
              }}
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
