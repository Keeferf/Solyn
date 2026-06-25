interface SidebarItemProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

export const SidebarItem = ({
  icon,
  label,
  active = false,
  disabled = false,
  onClick,
}: SidebarItemProps) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200
        ${active ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white"}
        ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}
      `}
    >
      <span className="shrink-0">{icon}</span>
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
};
