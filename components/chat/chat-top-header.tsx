import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectItem,
} from "@/components/ui/select";
import {
  AiOutlineMessage,
  AiOutlineReload,
  AiOutlineQuestionCircle,
  AiOutlinePhone,
  AiOutlineDesktop,
  AiOutlineDownload,
  AiOutlineBell,
  AiOutlineMenu,
} from "react-icons/ai";

export function ChatTopHeader() {
  return (
    <div className="flex items-center justify-between bg-white border-b border-gray-200 px-4 py-2">
      {/* Left side - Chats */}
      <div className="flex items-center space-x-2">
        <AiOutlineMessage className="h-5 w-5 text-gray-600" />
        <span className="text-lg font-medium text-gray-800">chats</span>
      </div>

      {/* Right side - Actions */}
      <div className="flex items-center space-x-3">
        {/* Refresh */}
        <Button
          variant="ghost"
          size="sm"
          className="flex items-center space-x-1 text-gray-600 hover:bg-gray-100"
        >
          <AiOutlineReload className="h-4 w-4" />
          <span className="text-sm">Refresh</span>
        </Button>

        {/* Help */}
        <Button
          variant="ghost"
          size="sm"
          className="flex items-center space-x-1 text-gray-600 hover:bg-gray-100"
        >
          <AiOutlineQuestionCircle className="h-4 w-4" />
          <span className="text-sm">Help</span>
        </Button>

        {/* Device Count */}
        <div className="flex items-center space-x-1">
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
            ●
          </Badge>
          <span className="text-sm text-gray-600">5 / 6 phones</span>
          <Button variant="ghost" size="icon" className="h-6 w-6">
            <AiOutlinePhone className="h-4 w-4 text-gray-500" />
          </Button>
        </div>

        {/* Desktop */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-gray-500 hover:bg-gray-100"
          title="Desktop"
        >
          <AiOutlineDesktop className="h-4 w-4" />
        </Button>

        {/* Download */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-gray-500 hover:bg-gray-100"
          title="Download"
        >
          <AiOutlineDownload className="h-4 w-4" />
        </Button>

        {/* Notifications */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-gray-500 hover:bg-gray-100"
          title="Notifications"
        >
          <AiOutlineBell className="h-4 w-4" />
        </Button>

        {/* Menu */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-gray-500 hover:bg-gray-100"
          title="Menu"
        >
          <AiOutlineMenu className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
} 