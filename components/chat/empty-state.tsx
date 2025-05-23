import { MessageSquare } from "lucide-react";

export function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center bg-gray-50">
      <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gray-100">
        <MessageSquare className="h-12 w-12 text-gray-400" />
      </div>
      <h3 className="mt-6 text-2xl font-semibold text-gray-900">
        Your messages
      </h3>
      <p className="mt-2 max-w-sm text-center text-gray-500">
        Select a chat from the sidebar to start messaging or create a new conversation.
      </p>
    </div>
  );
}