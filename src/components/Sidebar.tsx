import {
  FiPlus,
  FiSearch,
  FiMessageSquare,
  FiMoreHorizontal,
} from "react-icons/fi";

const Sidebar = () => {
  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-black border-r border-white/10 flex flex-col p-4">
      {/* Logo area */}
      <div className="mb-8 px-3">
        <h2 className="text-2xl font-bold font-anton bg-linear-to-r from-(--color-purple-accent) to-white bg-clip-text text-transparent">
          Solyn
        </h2>
      </div>

      {/* Navigation items */}
      <nav className="flex-1 space-y-1">
        <SidebarItem
          icon={<FiPlus size={20} />}
          label="New Chat"
          active={true}
        />
        <SidebarItem icon={<FiSearch size={20} />} label="Search" />
        <SidebarItem icon={<FiMessageSquare size={20} />} label="Chats" />
        <div className="pt-4 mt-4 border-t border-white/10">
          <SidebarItem
            icon={<FiMoreHorizontal size={20} />}
            label="More features coming"
            disabled={true}
          />
        </div>
      </nav>

      {/* Optional: bottom section for user/settings */}
      <div className="mt-auto pt-4 border-t border-white/10">
        <div className="px-3 py-2 text-sm text-white/40">v0.1.0</div>
      </div>
    </aside>
  );
};

// Sidebar item component
const SidebarItem = ({
  icon,
  label,
  active = false,
  disabled = false,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  disabled?: boolean;
}) => {
  return (
    <button
      disabled={disabled}
      className={`
        w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200
        ${
          active
            ? "bg-white/10 text-white"
            : "text-white/60 hover:bg-white/5 hover:text-white"
        }
        ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}
      `}
    >
      <span className="shrink-0">{icon}</span>
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
};

export default Sidebar;
