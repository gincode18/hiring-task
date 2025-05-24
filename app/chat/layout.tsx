"use client";

import { ChatSidebar } from "@/components/chat/chat-sidebar";
import { Navbar } from "@/components/chat/navbar";
import { ChatTopHeader } from "@/components/chat/chat-top-header";
import { ChatRightSidebar } from "@/components/chat/chat-right-sidebar";
import { ChatProvider } from "@/components/providers/chat-provider";

function ChatLayoutContent({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Navbar />
      <div className="flex flex-col h-full w-full">
        <ChatTopHeader />
        <div className="flex flex-1 overflow-hidden">
          <ChatSidebar />
          <div className="flex flex-1 overflow-hidden">
            {children}
            <ChatRightSidebar />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ChatProvider>
      <ChatLayoutContent>
        {children}
      </ChatLayoutContent>
    </ChatProvider>
  );
}
