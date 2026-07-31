import { useEffect, useRef } from "react";

interface DropdownMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onPin: () => void;
  onRename: () => void;
  onDelete: () => void;
  anchorRef: React.RefObject<HTMLSpanElement | null>;
}

export const DropdownMenu = ({
  isOpen,
  onClose,
  onPin,
  onRename,
  onDelete,
  anchorRef,
}: DropdownMenuProps) => {
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const isDropdown = dropdownRef.current?.contains(target);
      const isAnchor = anchorRef.current?.contains(target);

      if (!isDropdown && !isAnchor) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose, anchorRef]);

  if (!isOpen) return null;

  return (
    <div
      ref={dropdownRef}
      className="absolute right-0 mt-2 w-48 bg-black border border-white/10 rounded-lg shadow-lg overflow-hidden z-50"
      style={{ top: "100%" }}
    >
      <button
        onClick={() => {
          onPin();
          onClose();
        }}
        className="w-full px-4 py-2 text-left text-white/80 hover:bg-white/10 transition-colors text-sm cursor-pointer"
      >
        Pin Conversation
      </button>
      <button
        onClick={() => {
          onRename();
          onClose();
        }}
        className="w-full px-4 py-2 text-left text-white/80 hover:bg-white/10 transition-colors text-sm cursor-pointer"
      >
        Rename
      </button>
      <button
        onClick={() => {
          onDelete();
          onClose();
        }}
        className="w-full px-4 py-2 text-left text-error hover:bg-error-bg transition-colors text-sm border-t border-white/5 cursor-pointer"
      >
        Delete
      </button>
    </div>
  );
};
