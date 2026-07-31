interface SidebarItemProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  badge?: string;
  collapsed?: boolean;
}

export const SidebarItem = ({
  icon,
  label,
  active = false,
  disabled = false,
  onClick,
  badge,
  collapsed = false,
}: SidebarItemProps) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        w-full flex items-center rounded-lg transition-all duration-200
        ${active ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white"}
        ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}
        ${
          collapsed
            ? "justify-center w-10 h-10 mx-auto p-0"
            : "gap-3 px-3 py-2.5"
        }
      `}
      title={collapsed ? label : undefined}
    >
      <span
        className={`shrink-0 flex items-center justify-center ${
          collapsed ? "w-5 h-5" : "w-5 h-5"
        }`}
      >
        {icon}
      </span>
      {!collapsed && (
        <span className="text-sm font-medium flex-1 text-left">{label}</span>
      )}
      {!collapsed && badge && (
        <span className="text-xs px-2 py-0.5 rounded-full bg-bg-purple-accent/20 text-purple-accent">
          {badge}
        </span>
      )}
    </button>
  );
};
