import { FiChevronDown } from "react-icons/fi";
import { ModelType } from "./ChatInterface";

interface ModelSelectorProps {
  selectedModel: ModelType;
  models: { value: ModelType; label: string }[];
  isOpen: boolean;
  onToggle: () => void;
  onSelect: (model: ModelType) => void;
  onClose: () => void;
}

export const ModelSelector = ({
  selectedModel,
  models,
  isOpen,
  onToggle,
  onSelect,
  onClose,
}: ModelSelectorProps) => {
  return (
    <div className="relative">
      <button
        onClick={onToggle}
        className="flex items-center gap-1.5 px-2 py-1 text-xs text-white/80 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors cursor-pointer h-8"
      >
        <span>{models.find((m) => m.value === selectedModel)?.label}</span>
        <FiChevronDown
          size={12}
          className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={onClose} />
          <div className="absolute bottom-full mb-2 right-0 z-20 bg-black border border-white/10 rounded-lg shadow-lg py-1 min-w-[140px]">
            {models.map((model) => (
              <button
                key={model.value}
                onClick={() => onSelect(model.value)}
                className={`w-full text-left px-3 py-1.5 text-xs hover:bg-white/5 transition-colors cursor-pointer ${
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
  );
};
