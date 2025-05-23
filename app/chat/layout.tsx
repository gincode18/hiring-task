import { ChatSidebar } from "@/components/chat/chat-sidebar";
import { Navbar } from "@/components/chat/navbar";
import { ChatTopHeader } from "@/components/chat/chat-top-header";

export default function ChatLayout({
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
          {children}
        </div>
      </div>
    </div>
  );
}
