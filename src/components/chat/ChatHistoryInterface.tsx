import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { FiSearch, FiMessageSquare, FiClock } from "react-icons/fi";

interface ChatSession {
  id: number;
  title: string;
  model_name: string;
  created_at: string;
  updated_at: string;
}

interface ChatMessage {
  id: number;
  session_id: number;
  role: string;
  content: string;
  created_at: string;
}

interface ChatSessionWithMessages {
  session: ChatSession;
  messages: ChatMessage[];
}

// ============ SEPARATE COMPONENTS ============

// 1. Date Display Component - With dropdown
interface ChatDateProps {
  createdAt: string;
  showEllipsis?: boolean;
  onEllipsisClick?: (e: React.MouseEvent) => void;
}

const ChatDate = ({
  createdAt,
  showEllipsis = false,
  onEllipsisClick,
}: ChatDateProps) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  if (showEllipsis) {
    return (
      <div className="flex items-center justify-center text-xs text-white/30 w-full">
        <span
          onClick={onEllipsisClick}
          className="px-2 py-1 rounded border border-white/30 hover:border-purple-accent/60 transition-colors duration-200 cursor-pointer hover:bg-white/5"
        >
          •••
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-1 text-xs text-white/30 w-full">
      <FiClock className="w-3 h-3" />
      <span>{formatDate(createdAt)}</span>
    </div>
  );
};

// 2. Dropdown Menu Component - No icons
interface DropdownMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onPin: () => void;
  onRename: () => void;
  onDelete: () => void;
  anchorRef: React.RefObject<HTMLSpanElement | null>;
}

const DropdownMenu = ({
  isOpen,
  onClose,
  onPin,
  onRename,
  onDelete,
  anchorRef,
}: DropdownMenuProps) => {
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      // Check if click is on the dropdown itself
      const isDropdown =
        dropdownRef.current && dropdownRef.current.contains(target);

      // Check if click is on the ellipsis button
      const isAnchor = anchorRef.current && anchorRef.current.contains(target);

      // Close if click is outside both the dropdown AND the ellipsis button
      if (!isDropdown && !isAnchor) {
        onClose();
      }
    };

    // Use mousedown for immediate response
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose, anchorRef]);

  if (!isOpen) return null;

  return (
    <div
      ref={dropdownRef}
      className="absolute right-0 mt-2 w-48 bg-black border border-white/10 rounded-lg shadow-lg overflow-hidden z-50"
      style={{ top: "100%" }}
    >
      <button
        onClick={() => {
          onPin();
          onClose();
        }}
        className="w-full px-4 py-2 text-left text-white/80 hover:bg-white/10 transition-colors text-sm"
      >
        Pin Conversation
      </button>
      <button
        onClick={() => {
          onRename();
          onClose();
        }}
        className="w-full px-4 py-2 text-left text-white/80 hover:bg-white/10 transition-colors text-sm"
      >
        Rename
      </button>
      <button
        onClick={() => {
          onDelete();
          onClose();
        }}
        className="w-full px-4 py-2 text-left text-error hover:bg-error-bg transition-colors text-sm border-t border-white/5"
      >
        Delete
      </button>
    </div>
  );
};

// 3. Chat Item Component - With dropdown
interface ChatItemProps {
  chat: ChatSession;
  preview: string;
  isSelected: boolean;
  onSelect: (chatId: number) => void;
  onPin: (chatId: number) => void;
  onRename: (chatId: number) => void;
  onDelete: (chatId: number) => void;
}

const ChatItem = ({
  chat,
  preview,
  isSelected,
  onSelect,
  onPin,
  onRename,
  onDelete,
}: ChatItemProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const ellipsisRef = useRef<HTMLSpanElement>(null);

  const handleEllipsisClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Toggle the dropdown
    setIsDropdownOpen(!isDropdownOpen);
  };

  // Close dropdown when clicking on the chat item (to select it)
  const handleChatClick = () => {
    if (isDropdownOpen) {
      setIsDropdownOpen(false);
      return; // Don't select if dropdown was open, just close it
    }
    onSelect(chat.id);
  };

  const handlePin = () => {
    onPin(chat.id);
    console.log(`Pin chat ${chat.id}`);
  };

  const handleRename = () => {
    onRename(chat.id);
    console.log(`Rename chat ${chat.id}`);
  };

  const handleDelete = () => {
    onDelete(chat.id);
    console.log(`Delete chat ${chat.id}`);
  };

  return (
    <div
      key={chat.id}
      onClick={handleChatClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`
        group relative bg-white/5
        hover:bg-white/10 transition-all duration-200 
        cursor-pointer
        rounded-lg
        px-4 py-3
        mx-4
        mb-2
        ${isSelected ? "bg-white/10 ring-1 ring-purple-accent/30" : ""}
      `}
    >
      <div className="flex items-center justify-between">
        {/* Left side - Chat preview */}
        <div className="flex-1 min-w-0">
          <p className="text-white font-medium text-lg mb-1 truncate">
            {preview}
          </p>
          <div className="flex items-center gap-3 text-xs text-white/30">
            <span>Model: {chat.model_name}</span>
          </div>
        </div>

        {/* Right side - Date or ellipsis - Centered */}
        <div className="flex items-center h-full shrink-0 relative">
          <div className="flex flex-col text-xs text-white/30 min-w-17.5">
            <ChatDate
              createdAt={chat.created_at}
              showEllipsis={isHovered}
              onEllipsisClick={handleEllipsisClick}
            />
          </div>

          {/* Dropdown Menu */}
          <DropdownMenu
            isOpen={isDropdownOpen}
            onClose={() => setIsDropdownOpen(false)}
            onPin={handlePin}
            onRename={handleRename}
            onDelete={handleDelete}
            anchorRef={ellipsisRef}
          />
        </div>
      </div>
    </div>
  );
};

// ============ MAIN COMPONENT ============

export const ChatHistoryInterface = () => {
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [chatPreviews, setChatPreviews] = useState<Map<number, string>>(
    new Map(),
  );
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedChat, setSelectedChat] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadChats();
  }, []);

  const loadChats = async () => {
    setLoading(true);
    setError(null);
    try {
      const sessions = await invoke<ChatSession[]>("get_chat_sessions");
      setChats(sessions);

      const previews = new Map<number, string>();
      for (const session of sessions) {
        try {
          const chatData = await invoke<ChatSessionWithMessages | null>(
            "get_chat_session",
            { sessionId: session.id },
          );
          if (chatData && chatData.messages.length > 0) {
            const firstUserMessage = chatData.messages.find(
              (msg) => msg.role === "user",
            );
            if (firstUserMessage) {
              const firstLine = firstUserMessage.content.split("\n")[0];
              previews.set(session.id, firstLine);
            }
          }
        } catch (error) {
          console.error(
            `Failed to load preview for chat ${session.id}:`,
            error,
          );
        }
      }
      setChatPreviews(previews);
    } catch (error) {
      console.error("Failed to load chats:", error);
      setError("Failed to load chat history. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectChat = async (chatId: number) => {
    setSelectedChat(chatId);
    try {
      const chatData = await invoke<ChatSessionWithMessages | null>(
        "get_chat_session",
        { sessionId: chatId },
      );

      if (chatData) {
        console.log("Loaded chat:", chatData);
        // TODO: Navigate to chat view with the loaded messages
      }
    } catch (error) {
      console.error("Failed to load chat messages:", error);
    }
  };

  const handlePin = (chatId: number) => {
    // TODO: Implement pin functionality
    console.log(`Pinning chat ${chatId}`);
  };

  const handleRename = (chatId: number) => {
    // TODO: Implement rename functionality
    console.log(`Renaming chat ${chatId}`);
  };

  const handleDelete = async (chatId: number) => {
    // TODO: Implement delete functionality with confirmation
    console.log(`Deleting chat ${chatId}`);
    // Remove from UI optimistically
    setChats(chats.filter((chat) => chat.id !== chatId));
    setChatPreviews((prev) => {
      const newMap = new Map(prev);
      newMap.delete(chatId);
      return newMap;
    });
    if (selectedChat === chatId) {
      setSelectedChat(null);
    }
  };

  const filteredChats = chats.filter((chat) => {
    const preview = chatPreviews.get(chat.id) || "";
    return preview.toLowerCase().includes(searchTerm.toLowerCase());
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full w-full">
        <div className="text-white/40">Loading chats...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full px-4">
        <div className="text-error text-center">
          <p className="text-lg font-medium mb-2">Error loading chats</p>
          <p className="text-white/40 text-sm">{error}</p>
          <button
            onClick={loadChats}
            className="mt-4 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full max-w-6xl mx-auto">
      {/* Header with padding - Updated to use theme gradient */}
      <div className="px-4 pt-8 pb-4">
        <h1 className="text-4xl font-bold font-anton bg-linear-to-r from-purple-accent to-white/80 bg-clip-text text-transparent mb-2">
          Chat History
        </h1>
      </div>

      {/* Search Bar with padding */}
      <div className="px-4 pb-4">
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 w-4 h-4" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-10 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-purple-accent/50 transition-colors"
          />
        </div>
      </div>

      {/* Chat List with proper spacing */}
      {filteredChats.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-white/40 px-4">
          <FiMessageSquare className="w-12 h-12 mb-4 opacity-30" />
          <p className="text-lg font-medium">No conversations found</p>
          <p className="text-sm">
            {searchTerm
              ? "Try adjusting your search"
              : "Start a new conversation to get started"}
          </p>
        </div>
      ) : (
        <div className="flex flex-col flex-1 overflow-y-auto pb-4">
          {filteredChats.map((chat) => {
            const preview = chatPreviews.get(chat.id) || "No messages yet";
            return (
              <ChatItem
                key={chat.id}
                chat={chat}
                preview={preview}
                isSelected={selectedChat === chat.id}
                onSelect={handleSelectChat}
                onPin={handlePin}
                onRename={handleRename}
                onDelete={handleDelete}
              />
            );
          })}
        </div>
      )}

      {/* Stats Footer with padding */}
      {chats.length > 0 && (
        <div className="px-4 pt-4 pb-8 border-t border-white/10 text-white/30 text-xs flex justify-between">
          <span>Total: {chats.length} conversations</span>
          <span>
            Showing {filteredChats.length} of {chats.length}
          </span>
          <button
            onClick={loadChats}
            className="text-white/40 hover:text-white/70 transition-colors"
          >
            Refresh
          </button>
        </div>
      )}
    </div>
  );
};
