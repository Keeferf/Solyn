import { useState, useRef, useEffect } from "react";
import {
  FiSend,
  FiSearch,
  FiCode,
  FiChevronDown,
  FiPaperclip,
  FiArrowUp,
} from "react-icons/fi";

export type ModelType = "gpt-4" | "claude-3" | "gemini-pro" | "llama-3";
export type ModeType = "chat" | "agent";

// Toggle Button Component (icons only)
export const ToggleButton = ({
  isActive,
  onClick,
  icon,
}: {
  isActive: boolean;
  onClick: () => void;
  icon: React.ReactNode;
}) => {
  return (
    <button
      onClick={onClick}
      className={`p-2 rounded-lg transition-colors cursor-pointer ${
        isActive
          ? "bg-(--color-purple-accent)/20 hover:bg-(--color-purple-accent)/30 text-(--color-purple-accent)"
          : "text-(--color-purple-accent)/40 hover:text-(--color-purple-accent)/60 bg-transparent hover:bg-white/5"
      }`}
    >
      {icon}
    </button>
  );
};

export const ChatInterface = () => {
  const [input, setInput] = useState("");
  const [selectedModel, setSelectedModel] = useState<ModelType>("gpt-4");
  const [isSearchEnabled, setIsSearchEnabled] = useState(false);
  const [isCodeEnabled, setIsCodeEnabled] = useState(false);
  const [isAttachmentEnabled, setIsAttachmentEnabled] = useState(false);
  const [mode, setMode] = useState<ModeType>("chat");
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const models: { value: ModelType; label: string }[] = [
    { value: "gpt-4", label: "GPT-4" },
    { value: "claude-3", label: "Claude 3" },
    { value: "gemini-pro", label: "Gemini Pro" },
    { value: "llama-3", label: "Llama 3" },
  ];

  // Auto-resize function
  const autoResize = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      const newHeight = Math.min(textarea.scrollHeight, 200);
      textarea.style.height = `${newHeight}px`;
    }
  };

  // Resize when input changes
  useEffect(() => {
    autoResize();
  }, [input]);

  const handleSubmit = () => {
    if (input.trim()) {
      console.log("Sending message:", input);
      console.log("Mode:", mode);
      console.log("Model:", selectedModel);
      console.log("Search enabled:", isSearchEnabled);
      console.log("Code enabled:", isCodeEnabled);
      console.log("Attachment enabled:", isAttachmentEnabled);
      setInput("");

      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.style.height = "auto";
        }
      }, 0);
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

  const handleAttachmentClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      console.log("Files attached:", files);
      setIsAttachmentEnabled(true);
      // Reset the input so the same file can be selected again
      e.target.value = "";
    }
  };

  return (
    <div className="w-full">
      {/* Chat input area */}
      <div className="relative bg-white/5 rounded-2xl border border-white/10 hover:border-white/20 transition-colors">
        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message Solyn..."
          className="w-full bg-transparent text-white placeholder-white/40 resize-none p-4 pr-32 min-h-[52px] max-h-[200px] outline-none rounded-2xl"
          style={{
            scrollbarWidth: "thin",
            scrollbarColor: "rgba(255,255,255,0.2) transparent",
            height: "auto",
          }}
          rows={1}
        />

        {/* Bottom row with controls */}
        <div className="flex items-center justify-between p-2 border-t border-white/5">
          {/* Left side - Attachment, Search, and Code toggles (icons only) */}
          <div className="flex items-center gap-1">
            <ToggleButton
              isActive={isAttachmentEnabled}
              onClick={handleAttachmentClick}
              icon={<FiPaperclip size={18} />}
            />
            <ToggleButton
              isActive={isSearchEnabled}
              onClick={() => setIsSearchEnabled(!isSearchEnabled)}
              icon={<FiSearch size={18} />}
            />
            <ToggleButton
              isActive={isCodeEnabled}
              onClick={() => setIsCodeEnabled(!isCodeEnabled)}
              icon={<FiCode size={18} />}
            />
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {/* Right side - Model select + Mode toggle + Submit */}
          <div className="flex items-center gap-2">
            {/* Model Select */}
            <div className="relative">
              <button
                onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-white/80 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
              >
                <span>
                  {models.find((m) => m.value === selectedModel)?.label}
                </span>
                <FiChevronDown
                  size={14}
                  className={`transition-transform ${isModelDropdownOpen ? "rotate-180" : ""}`}
                />
              </button>

              {isModelDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setIsModelDropdownOpen(false)}
                  />
                  <div className="absolute bottom-full mb-2 right-0 z-20 bg-black border border-white/10 rounded-lg shadow-lg py-1 min-w-[160px]">
                    {models.map((model) => (
                      <button
                        key={model.value}
                        onClick={() => {
                          setSelectedModel(model.value);
                          setIsModelDropdownOpen(false);
                        }}
                        className={`w-full text-left px-4 py-2 text-sm hover:bg-white/5 transition-colors cursor-pointer ${
                          selectedModel === model.value
                            ? "text-white bg-white/5"
                            : "text-white/60"
                        }`}
                      >
                        {model.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Mode Toggle (Agent/Chat) - Smooth sliding bar */}
            <div
              className="relative flex items-center bg-white/10 rounded-lg p-0.5 cursor-pointer min-w-[120px] h-[34px]"
              onClick={toggleMode}
            >
              {/* Sliding background */}
              <div
                className={`absolute top-0.5 bottom-0.5 w-1/2 rounded-md bg-(--color-purple-accent) transition-all duration-300 ease-in-out ${
                  mode === "agent" ? "left-0.5" : "left-[calc(50%+0.5px)]"
                }`}
              />

              {/* Agent option */}
              <div
                className={`relative z-10 flex-1 text-center px-3 py-1.5 text-sm transition-colors duration-200 ${
                  mode === "agent"
                    ? "text-white"
                    : "text-white/60 hover:text-white/80"
                }`}
              >
                Agent
              </div>

              {/* Chat option */}
              <div
                className={`relative z-10 flex-1 text-center px-3 py-1.5 text-sm transition-colors duration-200 ${
                  mode === "chat"
                    ? "text-white"
                    : "text-white/60 hover:text-white/80"
                }`}
              >
                Chat
              </div>
            </div>

            {/* Submit Button */}
            <button
              onClick={handleSubmit}
              disabled={!input.trim()}
              className="p-2 bg-(--color-purple-accent) hover:bg-(--color-purple-accent)/80 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors text-white cursor-pointer"
            >
              <FiArrowUp size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Hint text */}
      <div className="mt-3 text-xs text-white/30 text-center">
        Press Enter to send, Shift+Enter for new line
      </div>
    </div>
  );
};
