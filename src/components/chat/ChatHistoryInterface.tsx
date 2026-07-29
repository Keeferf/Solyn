import { useState, useEffect } from "react";
import { FiSearch, FiTrash2, FiMessageSquare, FiClock } from "react-icons/fi";

interface Chat {
  id: string;
  title: string;
  lastMessage: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export const ChatHistoryInterface = () => {
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedChat, setSelectedChat] = useState<string | null>(null);

  useEffect(() => {
    loadChats();
  }, []);

  const loadChats = async () => {
    setLoading(true);
    try {
      // TODO: Replace with actual Tauri command to fetch chats
      const mockChats: Chat[] = [
        {
          id: "1",
          title: "React Component Design",
          lastMessage: "Let's discuss the component architecture...",
          createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
          updatedAt: new Date(Date.now() - 3600000 * 1).toISOString(),
          messageCount: 12,
        },
        {
          id: "2",
          title: "Ollama Integration",
          lastMessage: "The API response looks good...",
          createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
          updatedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
          messageCount: 8,
        },
        {
          id: "3",
          title: "UI/UX Improvements",
          lastMessage: "The new sidebar design is much cleaner...",
          createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
          updatedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
          messageCount: 15,
        },
      ];
      setChats(mockChats);
    } catch (error) {
      console.error("Failed to load chats:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteChat = async (chatId: string) => {
    if (!confirm("Are you sure you want to delete this chat?")) return;

    try {
      // TODO: Replace with actual Tauri command to delete chat
      setChats(chats.filter((chat) => chat.id !== chatId));
    } catch (error) {
      console.error("Failed to delete chat:", error);
    }
  };

  const handleSelectChat = (chatId: string) => {
    setSelectedChat(chatId);
    // TODO: Navigate to chat view with selected chat
    console.log("Selected chat:", chatId);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 3600000) {
      return `${Math.floor(diff / 60000)}m ago`;
    } else if (diff < 86400000) {
      return `${Math.floor(diff / 3600000)}h ago`;
    } else if (diff < 604800000) {
      return `${Math.floor(diff / 86400000)}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const filteredChats = chats.filter(
    (chat) =>
      chat.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      chat.lastMessage.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full w-full">
        <div className="text-white/40">Loading chats...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Chat History</h1>
        <p className="text-white/40 text-sm">Your saved conversations</p>
      </div>

      {/* Search Bar */}
      <div className="relative mb-6">
        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 w-4 h-4" />
        <input
          type="text"
          placeholder="Search conversations..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-10 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-purple-accent/50 transition-colors"
        />
      </div>

      {/* Chat List */}
      {filteredChats.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-white/40">
          <FiMessageSquare className="w-12 h-12 mb-4 opacity-30" />
          <p className="text-lg font-medium">No conversations found</p>
          <p className="text-sm">
            {searchTerm
              ? "Try adjusting your search"
              : "Start a new conversation to get started"}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredChats.map((chat) => (
            <div
              key={chat.id}
              onClick={() => handleSelectChat(chat.id)}
              className={`
                group relative bg-white/5 border border-white/10 rounded-lg p-4 
                hover:bg-white/10 hover:border-purple-accent/30 transition-all duration-200 
                cursor-pointer
                ${selectedChat === chat.id ? "bg-white/10 border-purple-accent/50" : ""}
              `}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-medium text-lg mb-1 truncate">
                    {chat.title}
                  </h3>
                  <p className="text-white/40 text-sm truncate">
                    {chat.lastMessage}
                  </p>
                </div>

                <div className="flex items-center gap-3 ml-4 shrink-0">
                  <div className="flex flex-col items-end text-xs text-white/30">
                    <div className="flex items-center gap-1">
                      <FiClock className="w-3 h-3" />
                      <span>{formatDate(chat.updatedAt)}</span>
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      <FiMessageSquare className="w-3 h-3" />
                      <span>{chat.messageCount} messages</span>
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteChat(chat.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 
                      p-2 rounded-lg hover:bg-error-bg text-white/40 hover:text-error"
                  >
                    <FiTrash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Stats Footer */}
      {chats.length > 0 && (
        <div className="mt-6 pt-4 border-t border-white/10 text-white/30 text-xs flex justify-between">
          <span>Total: {chats.length} conversations</span>
          <span>
            Showing {filteredChats.length} of {chats.length}
          </span>
        </div>
      )}
    </div>
  );
};
