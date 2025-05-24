"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AiOutlineCamera, AiOutlineLoading } from "react-icons/ai";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

interface AvatarUploadProps {
  onImageUpload: (url: string | null) => void;
  initialImage?: string;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
}

export function AvatarUpload({ 
  onImageUpload, 
  initialImage, 
  disabled = false,
  size = "lg" 
}: AvatarUploadProps) {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [currentImage, setCurrentImage] = useState<string | null>(initialImage || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sizeClasses = {
    sm: "h-12 w-12",
    md: "h-16 w-16", 
    lg: "h-24 w-24"
  };

  const compressImage = (file: File, maxWidth = 300, quality = 0.8): Promise<File> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        // Calculate new dimensions (square aspect ratio for avatars)
        const size = Math.min(img.width, img.height);
        const startX = (img.width - size) / 2;
        const startY = (img.height - size) / 2;

        canvas.width = maxWidth;
        canvas.height = maxWidth;

        // Draw cropped and resized image
        ctx?.drawImage(img, startX, startY, size, size, 0, 0, maxWidth, maxWidth);
        
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: 'image/jpeg', // Convert to JPEG for consistency
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              resolve(file);
            }
          },
          'image/jpeg',
          quality
        );
      };

      img.src = URL.createObjectURL(file);
    });
  };

  const uploadToSupabase = async (file: File, userId?: string): Promise<string | null> => {
    try {
      const fileExt = 'jpg'; // Always use jpg for consistency
      const fileName = `profile-${Date.now()}.${fileExt}`;
      const filePath = userId 
        ? `profile-pictures/${userId}/${fileName}`
        : `profile-pictures/temp/${fileName}`;

      const { data, error } = await supabase.storage
        .from("attachments")
        .upload(filePath, file, {
          upsert: true // Replace existing file if it exists
        });

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

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please select an image file",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select an image smaller than 5MB",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      // Compress the image
      const compressedFile = await compressImage(file);
      
      // Upload to Supabase
      const imageUrl = await uploadToSupabase(compressedFile);
      
      if (imageUrl) {
        setCurrentImage(imageUrl);
        onImageUpload(imageUrl);
        toast({
          title: "Success",
          description: "Profile picture uploaded successfully",
        });
      } else {
        throw new Error("Upload failed");
      }
    } catch (error) {
      console.error("Error uploading image:", error);
      toast({
        title: "Upload failed",
        description: "Failed to upload profile picture. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemoveImage = () => {
    setCurrentImage(null);
    onImageUpload(null);
  };

  return (
    <div className="flex flex-col items-center space-y-3">
      <div className="relative">
        <Avatar className={`${sizeClasses[size]} border-2 border-gray-200`}>
          {currentImage ? (
            <AvatarImage src={currentImage} alt="Profile picture" />
          ) : (
            <AvatarFallback className="bg-gray-100 text-gray-500">
              <AiOutlineCamera className="h-6 w-6" />
            </AvatarFallback>
          )}
        </Avatar>
        
        {/* Upload/Loading overlay */}
        <div className="absolute inset-0 rounded-full bg-black bg-opacity-50 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity cursor-pointer">
          {isUploading ? (
            <AiOutlineLoading className="h-5 w-5 text-white animate-spin" />
          ) : (
            <AiOutlineCamera className="h-5 w-5 text-white" />
          )}
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={disabled || isUploading}
        />
      </div>

      <div className="flex flex-col items-center space-y-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || isUploading}
          className="text-xs"
        >
          {isUploading ? "Uploading..." : currentImage ? "Change Photo" : "Add Photo"}
        </Button>
        
        {currentImage && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleRemoveImage}
            disabled={disabled || isUploading}
            className="text-xs text-gray-500 hover:text-red-500"
          >
            Remove
          </Button>
        )}
      </div>
    </div>
  );
} 