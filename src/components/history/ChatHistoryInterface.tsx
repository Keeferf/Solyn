import { useState } from "react";
import { FiSearch, FiMessageSquare } from "react-icons/fi";
import { ConfirmationModal } from "@/components/ui/ConfirmationModal";
import { RenameModal } from "@/components/ui/RenameModal";
import { ChatItem } from "./ChatItem";
import { useChatHistory } from "./hooks/useChatHistory.ts";
import { useChatPreviews } from "./hooks/useChatPreview.ts";

export const ChatHistoryInterface = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    chatId: null as number | null,
    chatTitle: "",
  });
  const [renameModal, setRenameModal] = useState({
    isOpen: false,
    chatId: null as number | null,
    currentTitle: "",
  });

  const {
    chats,
    loading: chatsLoading,
    error: chatsError,
    loadChats,
    getChatSession,
    renameChat,
    deleteChat,
    pinChat,
  } = useChatHistory();

  const {
    previews,
    loading: previewsLoading,
    updatePreview,
    removePreview,
  } = useChatPreviews(chats);

  const loading = chatsLoading || previewsLoading;

  const handleSelectChat = async (chatId: number) => {
    try {
      const chatData = await getChatSession(chatId);
      if (chatData) {
        console.log("Loaded chat:", chatData);
      }
    } catch (error) {
      console.error("Failed to load chat:", error);
    }
  };

  const handleRename = (chatId: number) => {
    const preview = previews.get(chatId) || "Untitled";
    setRenameModal({
      isOpen: true,
      chatId,
      currentTitle: preview,
    });
  };

  const performRename = async (newTitle: string) => {
    const chatId = renameModal.chatId;
    if (chatId === null) return;

    try {
      await renameChat(chatId, newTitle);
      updatePreview(chatId, newTitle);
      setRenameModal({ isOpen: false, chatId: null, currentTitle: "" });
    } catch (error) {
      alert("Failed to rename conversation. Please try again.");
    }
  };

  const handleDelete = (chatId: number) => {
    const preview = previews.get(chatId) || "Untitled";
    setConfirmModal({
      isOpen: true,
      chatId,
      chatTitle: preview.length > 30 ? preview.slice(0, 30) + "..." : preview,
    });
  };

  const performDelete = async () => {
    const chatId = confirmModal.chatId;
    if (chatId === null) return;

    try {
      await deleteChat(chatId);
      removePreview(chatId);
      setConfirmModal({ isOpen: false, chatId: null, chatTitle: "" });
    } catch (error) {
      alert("Failed to delete conversation. Please try again.");
    }
  };

  const filteredChats = chats.filter((chat) => {
    const preview = previews.get(chat.id) || "";
    return preview.toLowerCase().includes(searchTerm.toLowerCase());
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full w-full">
        <div className="text-white/40">Loading chats...</div>
      </div>
    );
  }

  if (chatsError) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full px-4">
        <div className="text-error text-center">
          <p className="text-lg font-medium mb-2">Error loading chats</p>
          <p className="text-white/40 text-sm">{chatsError}</p>
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
    <>
      <div className="flex flex-col h-full w-full max-w-6xl mx-auto">
        <div className="px-4 pt-8 pb-4">
          <h1 className="text-4xl font-bold font-anton bg-linear-to-r from-purple-accent to-white/80 bg-clip-text text-transparent mb-2">
            Chat History
          </h1>
        </div>

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
            {filteredChats.map((chat) => (
              <ChatItem
                key={chat.id}
                chat={chat}
                preview={previews.get(chat.id) || "No messages yet"}
                onSelect={handleSelectChat}
                onPin={pinChat}
                onRename={handleRename}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}

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

      <RenameModal
        isOpen={renameModal.isOpen}
        onClose={() =>
          setRenameModal({ isOpen: false, chatId: null, currentTitle: "" })
        }
        onRename={performRename}
        currentTitle={renameModal.currentTitle}
      />

      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={() =>
          setConfirmModal({ isOpen: false, chatId: null, chatTitle: "" })
        }
        onConfirm={performDelete}
        title="Delete Conversation"
        message="Are you sure you want to delete? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        confirmVariant="danger"
      />
    </>
  );
};
