import { ChatSidebar } from "@/components/chat/chat-sidebar";
import { Navbar } from "@/components/chat/navbar";

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Navbar />
      <ChatSidebar />
      {children}
    </div>
  );
}