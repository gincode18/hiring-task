"use client";

import { useAuth } from "@/components/providers/auth-provider";
import { Logo } from "@/components/ui/logo";
import { 
  AiOutlineHome,
  AiOutlineMessage,
  AiOutlineTool,
  AiOutlineBarChart,
  AiOutlineUnorderedList,
  AiOutlineSound,
  AiOutlineTeam,
  AiOutlineFile,
  AiOutlineArrowRight,
  AiOutlineMenu,
  AiOutlineSetting,
  AiOutlineBell,
  AiOutlineLogout,
} from "react-icons/ai";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navItems = [
  {
    icon: AiOutlineHome,
    href: "/dashboard",
    label: "Home",
  },
  {
    icon: AiOutlineMessage,
    href: "/chat",
    label: "Chats",
  },
  {
    icon: AiOutlineTool,
    href: "/tools",
    label: "Tools",
  },
  {
    icon: AiOutlineBarChart,
    href: "/analytics",
    label: "Analytics",
  },
  {
    icon: AiOutlineUnorderedList,
    href: "/lists",
    label: "Lists",
  },
  {
    icon: AiOutlineSound,
    href: "/audio",
    label: "Audio",
  },
  {
    icon: AiOutlineTeam,
    href: "/contacts",
    label: "Contacts",
  },
  {
    icon: AiOutlineFile,
    href: "/documents",
    label: "Documents",
  },
  {
    icon: AiOutlineArrowRight,
    href: "/actions",
    label: "Actions",
  },
  {
    icon: AiOutlineMenu,
    href: "/menu",
    label: "Menu",
  },
  {
    icon: AiOutlineSetting,
    href: "/settings",
    label: "Settings",
  },
];

export function Navbar() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();

  return (
    <div className="flex h-full w-16 flex-col items-center bg-white border-r border-gray-100">
      {/* Logo */}
      <div className="flex h-16 w-full items-center justify-center border-b border-gray-100">
        <Logo className="h-8 w-8" />
      </div>
      
      {/* Navigation Items */}
      <div className="flex flex-col items-center w-full py-2">
        {navItems.map((item, index) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex h-12 w-12 items-center justify-center transition-colors hover:bg-gray-50",
                isActive ? "text-green-600" : "text-gray-400 hover:text-gray-600"
              )}
              title={item.label}
            >
              <Icon className="h-5 w-5" />
            </Link>
          );
        })}
      </div>
      
      {/* Bottom Section */}
      <div className="mt-auto flex flex-col items-center pb-4">
        {user && (
          <div className="mb-3">
            <Avatar
              className="h-8 w-8 cursor-pointer"
              title={user.email || ""}
            />
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-12 w-12 text-gray-400 hover:bg-gray-50 hover:text-gray-600"
          title="Sign out"
          onClick={() => signOut()}
        >
          <AiOutlineLogout className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}