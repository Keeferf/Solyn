// src/components/models/ModalDetails/ModalHeader.tsx
import { FiX } from "react-icons/fi";

export const ModalHeader = ({
  title,
  onClose,
}: {
  title: string;
  onClose: () => void;
}) => (
  <div className="flex items-center justify-between p-6 border-b border-[#d8d4cf]/10">
    <h3 className="text-xl font-bold text-[#d8d4cf]">{title}</h3>
    <button
      onClick={onClose}
      className="p-2 hover:bg-[#d8d4cf]/10 rounded-lg transition-all text-[#d8d4cf]/60 hover:text-[#d8d4cf] cursor-pointer"
    >
      <FiX size={20} />
    </button>
  </div>
);
