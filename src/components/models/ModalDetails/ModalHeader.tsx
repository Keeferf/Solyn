import { FiX } from "react-icons/fi";

export const ModalHeader = ({
  title,
  onClose,
}: {
  title: string;
  onClose: () => void;
}) => (
  <div className="flex items-center justify-between p-6 border-b border-white/10">
    <h3 className="text-xl font-bold text-white">{title}</h3>
    <button
      onClick={onClose}
      className="p-2 hover:bg-white/10 rounded-lg transition-all text-white/60 hover:text-white cursor-pointer"
    >
      <FiX size={20} />
    </button>
  </div>
);
