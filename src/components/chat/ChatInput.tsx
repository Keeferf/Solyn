import { forwardRef, TextareaHTMLAttributes } from "react";

interface ChatInputProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}

export const ChatInput = forwardRef<HTMLTextAreaElement, ChatInputProps>(
  ({ value, onChange, onKeyDown, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        placeholder="Message Solyn..."
        className="w-full bg-transparent text-white placeholder-white/40 resize-none p-4 pr-32 min-h-[52px] max-h-[200px] outline-none rounded-2xl"
        style={{
          scrollbarWidth: "thin",
          scrollbarColor: "rgba(255,255,255,0.2) transparent",
          height: "auto",
        }}
        rows={1}
        {...props}
      />
    );
  },
);
