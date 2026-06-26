import { ModeType } from "./ChatInterface";

interface ModeToggleProps {
  mode: ModeType;
  onToggle: () => void;
}

export const ModeToggle = ({ mode, onToggle }: ModeToggleProps) => {
  const isChat = mode === "chat";

  return (
    <div
      className="relative flex items-center bg-white/5 rounded-lg p-0.5 cursor-pointer h-8"
      onClick={onToggle}
      role="switch"
      aria-checked={isChat}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === "Space") {
          e.preventDefault();
          onToggle();
        }
      }}
    >
      {/* Sliding background */}
      <div
        className={`absolute top-0.5 bottom-0.5 w-[calc(50%-2px)] rounded-md transition-all duration-300 ease-in-out ${
          isChat ? "right-0.5" : "left-0.5"
        }`}
        style={{
          background: "var(--color-purple-accent)",
        }}
      />

      {/* Agent label - left */}
      <span
        className={`relative z-10 w-[46px] text-xs font-medium rounded transition-colors duration-200 flex items-center justify-center h-full ${
          !isChat ? "text-white" : "text-white/60 hover:text-white/80"
        }`}
      >
        Agent
      </span>

      {/* Chat label - right */}
      <span
        className={`relative z-10 w-[46px] text-xs font-medium rounded transition-colors duration-200 flex items-center justify-center h-full ${
          isChat ? "text-white" : "text-white/60 hover:text-white/80"
        }`}
      >
        Chat
      </span>
    </div>
  );
};
