import { ModeType } from "./ChatInterface";

interface ModeToggleProps {
  mode: ModeType;
  onToggle: () => void;
}

export const ModeToggle = ({ mode, onToggle }: ModeToggleProps) => {
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => mode !== "agent" && onToggle()}
        className={`px-3 py-1.5 text-sm rounded-lg transition-colors cursor-pointer ${
          mode === "agent"
            ? "bg-(--color-purple-accent) text-white"
            : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80"
        }`}
      >
        Agent
      </button>

      <button
        onClick={() => mode !== "chat" && onToggle()}
        className={`px-3 py-1.5 text-sm rounded-lg transition-colors cursor-pointer ${
          mode === "chat"
            ? "bg-(--color-purple-accent) text-white"
            : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80"
        }`}
      >
        Chat
      </button>
    </div>
  );
};
