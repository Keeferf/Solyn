import { useState } from "react";
import { ChatInput } from "./ChatInput";
import { ChatControls } from "./ChatControls";
import { useChatInput } from "./hooks/useChatInput";
import { useFileAttachment } from "./hooks/useFileAttachment";
import { useModelSelection, ModelType } from "./hooks/useModelSelection";

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
    isLoading,
    selectModel,
    toggleDropdown,
    closeDropdown,
    getSelectedModelData,
  } = useModelSelection();

  const handleSubmit = () => {
    if (input.trim() && !isLoading && models.length > 0) {
      const modelData = getSelectedModelData();
      console.log("Sending message:", input);
      console.log("Mode:", mode);
      console.log("Model:", selectedModel);
      console.log("Model data:", modelData);
      console.log("Search enabled:", isSearchEnabled);
      console.log("Code enabled:", isCodeEnabled);
      console.log("Attachment enabled:", isAttachmentEnabled);

      // Here you would actually send the message to the model
      // For now, just log it
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

  const hasValidModels =
    models.length > 0 &&
    models[0].value !== "no-models" &&
    models[0].value !== "error";
  const isSubmitDisabled = !input.trim() || isLoading || !hasValidModels;

  return (
    <div className="w-full">
      <div className="relative bg-white/5 rounded-2xl border border-white/10 hover:border-white/20 transition-colors">
        <ChatInput
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={!hasValidModels}
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
          isLoading={isLoading}
          onModelToggle={toggleDropdown}
          onModelSelect={selectModel}
          onModelClose={closeDropdown}
          mode={mode}
          onModeToggle={toggleMode}
          onSubmit={handleSubmit}
          isSubmitDisabled={isSubmitDisabled}
          fileInputRef={fileInputRef}
          onFileChange={handleFileChange}
        />
      </div>

      <div className="mt-3 text-xs text-white/30 text-center">
        {!hasValidModels && !isLoading
          ? "No models installed. Please download a model from the Hugging Face page."
          : isLoading
            ? "Loading models..."
            : "Press Enter to send, Shift+Enter for new line"}
      </div>
    </div>
  );
};
