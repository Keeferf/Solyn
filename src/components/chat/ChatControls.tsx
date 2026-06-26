import { FiSearch, FiCode, FiPaperclip, FiArrowUp } from "react-icons/fi";
import { ToggleButton } from "./ToggleButton";
import { ModelSelector } from "./ModelSelector";
import { ModeToggle } from "./ModeToggle";
import { ModelType, ModeType } from "./ChatInterface";

interface ChatControlsProps {
  // Search
  isSearchEnabled: boolean;
  onSearchToggle: () => void;
  // Code
  isCodeEnabled: boolean;
  onCodeToggle: () => void;
  // Attachment
  isAttachmentEnabled: boolean;
  onAttachmentClick: () => void;
  // Model
  selectedModel: ModelType;
  models: { value: ModelType; label: string }[];
  isModelDropdownOpen: boolean;
  onModelToggle: () => void;
  onModelSelect: (model: ModelType) => void;
  onModelClose: () => void;
  // Mode
  mode: ModeType;
  onModeToggle: () => void;
  // Submit
  onSubmit: () => void;
  isSubmitDisabled: boolean;
  // File input - allow null
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const ChatControls = ({
  isSearchEnabled,
  onSearchToggle,
  isCodeEnabled,
  onCodeToggle,
  isAttachmentEnabled,
  onAttachmentClick,
  selectedModel,
  models,
  isModelDropdownOpen,
  onModelToggle,
  onModelSelect,
  onModelClose,
  mode,
  onModeToggle,
  onSubmit,
  isSubmitDisabled,
  fileInputRef,
  onFileChange,
}: ChatControlsProps) => {
  return (
    <div className="flex items-center justify-between p-2 border-t border-white/5">
      {/* Left side - Attachment, Search, and Code toggles */}
      <div className="flex items-center gap-1">
        <ToggleButton
          isActive={isAttachmentEnabled}
          onClick={onAttachmentClick}
          icon={<FiPaperclip size={18} />}
        />
        <ToggleButton
          isActive={isSearchEnabled}
          onClick={onSearchToggle}
          icon={<FiSearch size={18} />}
        />
        <ToggleButton
          isActive={isCodeEnabled}
          onClick={onCodeToggle}
          icon={<FiCode size={18} />}
        />
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={onFileChange}
          className="hidden"
        />
      </div>

      {/* Right side - Model select + Mode toggle + Submit */}
      <div className="flex items-center gap-2">
        <ModelSelector
          selectedModel={selectedModel}
          models={models}
          isOpen={isModelDropdownOpen}
          onToggle={onModelToggle}
          onSelect={onModelSelect}
          onClose={onModelClose}
        />

        <ModeToggle mode={mode} onToggle={onModeToggle} />

        <button
          onClick={onSubmit}
          disabled={isSubmitDisabled}
          className="p-2 bg-(--color-purple-accent) hover:bg-(--color-purple-accent)/80 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors text-white cursor-pointer"
        >
          <FiArrowUp size={18} />
        </button>
      </div>
    </div>
  );
};
