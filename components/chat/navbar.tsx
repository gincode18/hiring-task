"use client";

import { useAuth } from "@/components/providers/auth-provider";
import { Logo } from "@/components/ui/logo";
import { 
  MessageSquare, 
  Users, 
  BarChart, 
  Settings, 
  BellRing,
  LogOut,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navItems = [
  {
    icon: MessageSquare,
    href: "/chat",
    label: "Chats",
  },
  {
    icon: Users,
    href: "/contacts",
    label: "Contacts",
  },
  {
    icon: BarChart,
    href: "/analytics",
    label: "Analytics",
  },
  {
    icon: Settings,
    href: "/settings",
    label: "Settings",
  },
];

export function Navbar() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();

  return (
    <div className="flex h-full w-16 flex-col items-center border-r bg-white py-4">
      <Logo className="h-8 w-8" />
      <div className="mt-8 flex flex-col items-center gap-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-full transition-colors",
                isActive
                  ? "bg-green-100 text-green-600"
                  : "text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              )}
              title={item.label}
            >
              <Icon className="h-5 w-5" />
            </Link>
          );
        })}
      </div>
      <div className="mt-auto flex flex-col items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          title="Notifications"
        >
          <BellRing className="h-5 w-5" />
        </Button>
        {user && (
          <Avatar
            className="h-8 w-8 cursor-pointer border border-green-200"
            title={user.email || ""}
          />
        )}
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          title="Sign out"
          onClick={() => signOut()}
        >
          <LogOut className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}