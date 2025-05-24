import { format } from "date-fns";
import { AiOutlineCheck, AiOutlineDownload, AiOutlineFile, AiOutlineFileImage, AiOutlineAudio } from "react-icons/ai";
import { Avatar } from "@/components/ui/avatar";
import { Database } from "@/lib/database.types";
import { cn } from "@/lib/utils";

type Message = Database["public"]["Tables"]["messages"]["Row"] & {
  profiles: Database["public"]["Tables"]["profiles"]["Row"];
};

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
}

interface AttachmentData {
  fileName: string;
  fileUrl: string;
  fileSize: number;
  fileType: string;
}

export function MessageBubble({ message, isOwn }: MessageBubbleProps) {
  const formattedTime = format(new Date(message.created_at), "HH:mm");

  const renderAttachment = (attachmentData: AttachmentData) => {
    const { fileName, fileUrl, fileSize, fileType } = attachmentData;
    const fileSizeMB = (fileSize / 1024 / 1024).toFixed(1);

    // Image attachment
    if (fileType.startsWith("image/")) {
      return (
        <div className="max-w-xs">
          <img
            src={fileUrl}
            alt={fileName}
            className="rounded-lg max-w-full h-auto cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => window.open(fileUrl, '_blank')}
          />
          <div className="mt-1 text-xs opacity-75">
            {fileName} • {fileSizeMB} MB
          </div>
        </div>
      );
    }

    // Video attachment
    if (fileType.startsWith("video/")) {
      return (
        <div className="max-w-xs">
          <video
            controls
            className="rounded-lg max-w-full h-auto"
            style={{ maxHeight: "200px" }}
          >
            <source src={fileUrl} type={fileType} />
            Your browser does not support the video tag.
          </video>
          <div className="mt-1 text-xs opacity-75">
            {fileName} • {fileSizeMB} MB
          </div>
        </div>
      );
    }

    // Audio attachment
    if (fileType.startsWith("audio/")) {
      return (
        <div className="max-w-xs">
          <div className="flex items-center space-x-2 p-2 bg-gray-50 rounded-lg">
            <AiOutlineAudio className="h-5 w-5 text-gray-600" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-700 truncate">{fileName}</p>
              <p className="text-xs text-gray-500">{fileSizeMB} MB</p>
            </div>
          </div>
          <audio controls className="w-full mt-2">
            <source src={fileUrl} type={fileType} />
            Your browser does not support the audio tag.
          </audio>
        </div>
      );
    }

    // Other file types
    return (
      <div className="max-w-xs">
        <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
          <div className="shrink-0">
            {fileType.includes("pdf") ? (
              <div className="w-8 h-8 bg-red-100 rounded flex items-center justify-center">
                <span className="text-red-600 text-xs font-bold">PDF</span>
              </div>
            ) : fileType.includes("doc") ? (
              <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center">
                <span className="text-blue-600 text-xs font-bold">DOC</span>
              </div>
            ) : (
              <AiOutlineFile className="h-8 w-8 text-gray-600" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-700 truncate">{fileName}</p>
            <p className="text-xs text-gray-500">{fileSizeMB} MB</p>
          </div>
          <a
            href={fileUrl}
            download={fileName}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 p-1 hover:bg-gray-200 rounded"
            onClick={(e) => e.stopPropagation()}
          >
            <AiOutlineDownload className="h-4 w-4 text-gray-600" />
          </a>
        </div>
      </div>
    );
  };

  const renderMessageContent = () => {
    if (message.type === "attachment") {
      try {
        const attachmentData: AttachmentData = JSON.parse(message.content);
        return renderAttachment(attachmentData);
      } catch (error) {
        console.error("Error parsing attachment data:", error);
        return <p className="text-sm text-red-500">Error loading attachment</p>;
      }
    }

    // Regular text message
    return <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>;
  };

  return (
    <div
      className={cn(
        "mb-3 flex",
        isOwn ? "justify-end" : "justify-start"
      )}
    >
      {!isOwn && (
        <Avatar
          className="mr-3 h-10 w-10 self-start mt-1 bg-gray-200"
        />
      )}
      <div className={cn("flex flex-col", isOwn ? "items-end" : "items-start")}>
        {!isOwn && (
          <div className="mb-1 text-sm font-semibold text-green-600">
            {message.profiles.full_name}
          </div>
        )}
        <div
          className={cn(
            "relative max-w-md rounded-lg shadow-sm",
            message.type === "attachment" ? "p-2" : "px-3 py-2",
            isOwn
              ? "bg-green-500 text-white rounded-br-sm"
              : "bg-white text-gray-800 border border-gray-200 rounded-bl-sm"
          )}
        >
          {renderMessageContent()}
          <div
            className={cn(
              "mt-1 flex items-center justify-end space-x-1 text-xs",
              isOwn ? "text-green-100" : "text-gray-500"
            )}
          >
            <span>{formattedTime}</span>
            {isOwn && (
              <div className="flex">
                <AiOutlineCheck className={cn("h-3 w-3", message.is_read ? "text-blue-200" : "text-green-200")} />
                {message.is_read && (
                  <AiOutlineCheck className="h-3 w-3 text-blue-200 -ml-1.5" />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}