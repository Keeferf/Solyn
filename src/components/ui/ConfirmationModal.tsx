// src/components/ui/ConfirmationModal.tsx
import { useEffect, useRef } from "react";
import { FiAlertTriangle, FiX } from "react-icons/fi";

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: "danger" | "warning" | "primary";
}

export const ConfirmationModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  confirmVariant = "danger",
}: ConfirmationModalProps) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        modalRef.current &&
        !modalRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    // Prevent body scroll
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const getVariantStyles = () => {
    switch (confirmVariant) {
      case "danger":
        return "bg-error hover:bg-error/80"; // Uses theme error color
      case "warning":
        return "bg-warning hover:bg-warning/80"; // Uses theme warning color
      case "primary":
        return "bg-purple-accent hover:bg-purple-accent/80"; // Uses theme purple accent
      default:
        return "bg-purple-accent hover:bg-purple-accent/80";
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-100">
      <div
        ref={modalRef}
        className="bg-black border border-white/10 rounded-xl max-w-md w-full mx-4 p-6 shadow-2xl animate-fadeIn animate-slideUp"
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-error-bg">
              <FiAlertTriangle className="w-5 h-5 text-error" />
            </div>
            <h2 className="text-xl font-semibold text-white">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white/70 transition-colors cursor-pointer"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* Message */}
        <p className="text-white/60 text-sm leading-relaxed mb-6">
          {message ||
            "Are you sure you want to delete? This action cannot be undone."}
        </p>

        {/* Actions */}
        <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-white/10 hover:bg-white/5 text-white/70 transition-colors text-sm font-medium cursor-pointer"
          >
            {cancelText}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`px-4 py-2 rounded-lg text-white font-medium transition-colors text-sm cursor-pointer ${getVariantStyles()}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
