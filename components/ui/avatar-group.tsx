import React from "react";
import { Avatar } from "./avatar";
import { cn } from "@/lib/utils";

interface AvatarGroupProps {
  items: Array<{
    name: string;
    image?: string | null;
  }>;
  limit?: number;
  className?: string;
}

export function AvatarGroup({ items, limit = 3, className }: AvatarGroupProps) {
  const itemsToShow = items.slice(0, limit);
  const excess = Math.max(items.length - limit, 0);

  return (
    <div className={cn("flex items-center", className)}>
      {itemsToShow.map((item, i) => (
        <div
          key={i}
          className={cn("relative inline-block rounded-full ring-2 ring-white", {
            "-ml-2": i !== 0,
          })}
        >
          <Avatar
            className="h-8 w-8"
            // fallback={item.name.charAt(0)}
          />
        </div>
      ))}
      {excess > 0 && (
        <div className="-ml-2 flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-500 ring-2 ring-white">
          +{excess}
        </div>
      )}
    </div>
  );
}