import { useState } from "react";
import {
  FiSearch,
  FiMessageSquare,
  FiCheckSquare,
  FiSquare,
  FiTrash2,
  FiX,
} from "react-icons/fi";
import { ConfirmationModal } from "@/components/ui/ConfirmationModal";
import { RenameModal } from "@/components/ui/RenameModal";
import { ChatItem } from "./ChatItem";
import { useChatHistory } from "./hooks/useChatHistory.ts";
import { useChatPreviews } from "./hooks/useChatPreview.ts";

export const ChatHistoryInterface = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedChats, setSelectedChats] = useState<Set<number>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    chatId: null as number | null,
    chatTitle: "",
    isMassDelete: false,
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

  const filteredChats = chats.filter((chat) => {
    const preview = previews.get(chat.id) || "";
    return preview.toLowerCase().includes(searchTerm.toLowerCase());
  });

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
      isMassDelete: false,
    });
  };

  const performDelete = async () => {
    const chatId = confirmModal.chatId;
    if (chatId === null) return;

    try {
      await deleteChat(chatId);
      removePreview(chatId);
      setConfirmModal({
        isOpen: false,
        chatId: null,
        chatTitle: "",
        isMassDelete: false,
      });
    } catch (error) {
      alert("Failed to delete conversation. Please try again.");
    }
  };

  // Selection handlers
  const toggleChatSelection = (chatId: number) => {
    setSelectedChats((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(chatId)) {
        newSet.delete(chatId);
      } else {
        newSet.add(chatId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    const visibleChatIds = filteredChats.map((chat) => chat.id);
    const allSelected = visibleChatIds.every((id) => selectedChats.has(id));

    if (allSelected) {
      setSelectedChats(new Set());
    } else {
      setSelectedChats(new Set(visibleChatIds));
    }
  };

  const handleMassDelete = () => {
    if (selectedChats.size === 0) return;

    setConfirmModal({
      isOpen: true,
      chatId: null,
      chatTitle: `${selectedChats.size} conversations`,
      isMassDelete: true,
    });
  };

  const performMassDelete = async () => {
    try {
      const deletePromises = Array.from(selectedChats).map((chatId) =>
        deleteChat(chatId),
      );
      await Promise.all(deletePromises);

      // Clear selected chats after deletion
      setSelectedChats(new Set());
      setIsSelectionMode(false);

      setConfirmModal({
        isOpen: false,
        chatId: null,
        chatTitle: "",
        isMassDelete: false,
      });
    } catch (error) {
      alert("Failed to delete conversations. Please try again.");
    }
  };

  const exitSelectionMode = () => {
    setSelectedChats(new Set());
    setIsSelectionMode(false);
  };

  const enterSelectionMode = () => {
    setIsSelectionMode(true);
  };

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
            className="mt-4 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors cursor-pointer"
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
        <div className="px-4 pt-8 pb-4 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold font-anton bg-linear-to-r from-purple-accent to-white/80 bg-clip-text text-transparent mb-1">
              Chat History
            </h1>
          </div>

          <div className="flex gap-2">
            {!isSelectionMode ? (
              <button
                onClick={enterSelectionMode}
                className="px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-white/60 hover:text-white transition-colors flex items-center gap-2 text-sm cursor-pointer"
              >
                <FiCheckSquare className="w-4 h-4" />
                Select
              </button>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-white/60">
                    {selectedChats.size} selected
                  </span>
                  <button
                    onClick={toggleSelectAll}
                    className="px-3 py-2 bg-purple-accent/20 hover:bg-purple-accent/30 rounded-lg text-purple-accent hover:text-purple-accent/90 transition-colors flex items-center gap-2 text-sm cursor-pointer border border-purple-accent/30"
                  >
                    {filteredChats.every((chat) =>
                      selectedChats.has(chat.id),
                    ) ? (
                      <FiCheckSquare className="w-4 h-4" />
                    ) : (
                      <FiSquare className="w-4 h-4" />
                    )}
                    Select All
                  </button>
                </div>

                <button
                  onClick={handleMassDelete}
                  disabled={selectedChats.size === 0}
                  className={`px-3 py-2 rounded-lg transition-colors flex items-center gap-2 text-sm ${
                    selectedChats.size > 0
                      ? "bg-error/20 hover:bg-error/30 text-error hover:text-error/90 cursor-pointer"
                      : "bg-white/5 text-white/30 cursor-not-allowed"
                  }`}
                >
                  <FiTrash2 className="w-4 h-4" />
                  Delete Selected
                </button>

                <button
                  onClick={exitSelectionMode}
                  className="px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-white/60 hover:text-white transition-colors flex items-center gap-2 text-sm cursor-pointer"
                >
                  <FiX className="w-4 h-4" />
                  Cancel
                </button>
              </>
            )}
          </div>
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
                isSelectionMode={isSelectionMode}
                isSelected={selectedChats.has(chat.id)}
                onToggleSelect={toggleChatSelection}
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
              className="text-white/40 hover:text-white/70 transition-colors cursor-pointer"
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
          setConfirmModal({
            isOpen: false,
            chatId: null,
            chatTitle: "",
            isMassDelete: false,
          })
        }
        onConfirm={
          confirmModal.isMassDelete ? performMassDelete : performDelete
        }
        title={
          confirmModal.isMassDelete
            ? `Delete ${confirmModal.chatTitle}`
            : "Delete Conversation"
        }
        message={
          confirmModal.isMassDelete
            ? `Are you sure you want to delete ${confirmModal.chatTitle}? This action cannot be undone.`
            : `Are you sure you want to delete "${confirmModal.chatTitle}"? This action cannot be undone.`
        }
        confirmText="Delete"
        cancelText="Cancel"
        confirmVariant="danger"
      />
    </>
  );
};
