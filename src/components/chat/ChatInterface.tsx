import { useState } from "react";
import { ChatInput } from "./ChatInput";
import { ChatControls } from "./ChatControls";
import { useChatInput } from "./hooks/useChatInput";
import { useFileAttachment } from "./hooks/useFileAttachment";
import { useModelSelection } from "./hooks/useModelSelection";

export type ModelType = "gpt-4" | "claude-3" | "gemini-pro" | "llama-3";
export type ModeType = "chat" | "agent";

export const ChatInterface = () => {
  const [isSearchEnabled, setIsSearchEnabled] = useState(false);
  const [isCodeEnabled, setIsCodeEnabled] = useState(false);
  const [mode, setMode] = useState<ModeType>("chat");

  // Custom hooks
  const { input, setInput, textareaRef, resetInput } = useChatInput();
  const {
    isAttachmentEnabled,
    fileInputRef,
    handleAttachmentClick,
    handleFileChange,
  } = useFileAttachment();
  const {
    selectedModel,
    models,
    isModelDropdownOpen,
    selectModel,
    toggleDropdown,
    closeDropdown,
  } = useModelSelection();

  const handleSubmit = () => {
    if (input.trim()) {
      console.log("Sending message:", input);
      console.log("Mode:", mode);
      console.log("Model:", selectedModel);
      console.log("Search enabled:", isSearchEnabled);
      console.log("Code enabled:", isCodeEnabled);
      console.log("Attachment enabled:", isAttachmentEnabled);
      resetInput();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const toggleMode = () => {
    setMode(mode === "chat" ? "agent" : "chat");
  };

  return (
    <div className="w-full">
      <div className="relative bg-white/5 rounded-2xl border border-white/10 hover:border-white/20 transition-colors">
        <ChatInput
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
        />

        <ChatControls
          isSearchEnabled={isSearchEnabled}
          onSearchToggle={() => setIsSearchEnabled(!isSearchEnabled)}
          isCodeEnabled={isCodeEnabled}
          onCodeToggle={() => setIsCodeEnabled(!isCodeEnabled)}
          isAttachmentEnabled={isAttachmentEnabled}
          onAttachmentClick={handleAttachmentClick}
          selectedModel={selectedModel}
          models={models}
          isModelDropdownOpen={isModelDropdownOpen}
          onModelToggle={toggleDropdown}
          onModelSelect={selectModel}
          onModelClose={closeDropdown}
          mode={mode}
          onModeToggle={toggleMode}
          onSubmit={handleSubmit}
          isSubmitDisabled={!input.trim()}
          fileInputRef={fileInputRef}
          onFileChange={handleFileChange}
        />
      </div>

      <div className="mt-3 text-xs text-white/30 text-center">
        Press Enter to send, Shift+Enter for new line
      </div>
    </div>
  );
};
