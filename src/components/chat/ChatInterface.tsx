import { useState } from "react";
import { ChatInput } from "./ChatInput";
import { ChatControls } from "./ChatControls";
import { ChatMessages } from "./ChatMessages";
import { useChatInput } from "./hooks/useChatInput";
import { useFileAttachment } from "./hooks/useFileAttachment";
import { useModelSelection } from "./hooks/useModelSelection";
import { useChat } from "./hooks/useChat";

export type ModeType = "chat" | "agent";

export const ChatInterface = () => {
  const [isSearchEnabled, setIsSearchEnabled] = useState(false);
  const [isCodeEnabled, setIsCodeEnabled] = useState(false);
  const [mode, setMode] = useState<ModeType>("chat");
  const { input, setInput, textareaRef, resetInput } = useChatInput();
  const {
    isAttachmentEnabled,
    attachments,
    fileInputRef,
    handleAttachmentClick,
    handleFileChange,
    clearAttachments,
  } = useFileAttachment();
  const {
    selectedModel,
    models,
    isModelDropdownOpen,
    isLoading: isModelsLoading,
    selectModel,
    toggleDropdown,
    closeDropdown,
    getSelectedModelData,
  } = useModelSelection();

  const selectedModelData = getSelectedModelData();

  // Debug logging
  console.log("Selected Model Data:", selectedModelData);
  console.log("Ollama Model Name:", selectedModelData?.ollama_model_name);

  const {
    messages,
    isLoading: isChatLoading,
    isStreaming, // Add this
    error,
    isOllamaReady,
    sendMessage,
    clearMessages: _clearMessages,
  } = useChat(
    selectedModelData && selectedModelData.ollama_model_name
      ? {
          model_id: selectedModelData.model_id,
          filename: selectedModelData.filename,
          ollama_model_name: selectedModelData.ollama_model_name,
        }
      : undefined,
  );

  const handleSubmit = async () => {
    console.log("Submit triggered. Input:", input.trim());
    console.log("Chat loading:", isChatLoading);
    console.log("Models:", models.length);
    console.log("Selected model data:", selectedModelData);

    if (
      input.trim() &&
      !isChatLoading &&
      models.length > 0 &&
      selectedModelData
    ) {
      let message = input.trim();

      if (attachments.length > 0) {
        console.log("Attachments:", attachments);
        const attachmentNames = attachments.map((f) => f.name).join(", ");
        message = `${message}\n\n[Attachments: ${attachmentNames}]`;
        clearAttachments();
      }

      resetInput();
      await sendMessage(message);
    } else {
      console.log("Submit blocked:", {
        hasInput: !!input.trim(),
        isChatLoading,
        hasModels: models.length > 0,
        hasSelectedModelData: !!selectedModelData,
      });
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

  const isSubmitDisabled =
    !input.trim() ||
    isChatLoading ||
    !hasValidModels ||
    !isOllamaReady ||
    !selectedModelData?.ollama_model_name;

  const attachmentCount = attachments.length;
  const hasMessages = messages.length > 0;

  return (
    <div className="flex flex-col h-full w-full relative">
      {hasMessages && (
        <div className="flex-1 min-h-0 overflow-y-auto pb-4">
          <ChatMessages
            messages={messages}
            isLoading={isChatLoading}
            isStreaming={isStreaming} // Add this
            error={error}
            isOllamaReady={isOllamaReady}
          />
        </div>
      )}

      {!hasMessages && (
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="text-center mb-8">
            <h1 className="text-7xl md:text-8xl font-bold tracking-wide font-anton bg-linear-to-r from-purple-accent to-white bg-clip-text text-transparent">
              Solyn
            </h1>
            <p className="text-lg md:text-xl leading-relaxed text-white/80 mt-4">
              A clarity-driven AI for solving complex problems and simplifying
              everyday work.
            </p>
          </div>

          <div className="w-full max-w-3xl">
            <div className="relative bg-white/5 rounded-2xl border border-white/10 transition-colors">
              <ChatInput
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={!hasValidModels || !isOllamaReady}
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
                isLoading={isModelsLoading}
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
              {!isOllamaReady
                ? "Ollama is not running. Please install and start Ollama."
                : !hasValidModels && !isModelsLoading
                  ? "No models installed. Please download a model from the Hugging Face page."
                  : isModelsLoading
                    ? "Loading models..."
                    : !selectedModelData?.ollama_model_name
                      ? "Selected model is not registered with Ollama. Please reinstall."
                      : "Press Enter to send, Shift+Enter for new line"}
            </div>
          </div>
        </div>
      )}

      {hasMessages && (
        <div className="shrink-0 w-full sticky bottom-0 bg-black/80 backdrop-blur-sm">
          {attachmentCount > 0 && (
            <div className="px-4 py-2 text-xs text-white/60 bg-white/5 border-t border-white/5">
              {attachmentCount} file{attachmentCount > 1 ? "s" : ""} attached
              <button
                onClick={clearAttachments}
                className="ml-2 text-red-400 hover:text-red-300"
              >
                Clear
              </button>
            </div>
          )}

          <div className="relative bg-white/5 rounded-2xl border border-white/10 transition-colors">
            <ChatInput
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={!hasValidModels || !isOllamaReady}
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
              isLoading={isModelsLoading}
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
            Press Enter to send, Shift+Enter for new line
          </div>
        </div>
      )}
    </div>
  );
};
