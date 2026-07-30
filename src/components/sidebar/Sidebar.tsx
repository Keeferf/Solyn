import { SidebarItem } from "./SidebarItem";
import { NAVIGATION_ITEMS, FOOTER_ITEMS } from "./SidebarNavigation";
import { OllamaVersionIndicator } from "./OllamaVersionIndicator";

interface SidebarProps {
  onNavigate?: (view: "chat" | "history" | "models") => void;
  currentView?: "chat" | "history" | "models";
}

export const Sidebar = ({ onNavigate, currentView = "chat" }: SidebarProps) => {
  const handleNavigation = (id: string) => {
    if (id === "models") {
      onNavigate?.("models");
    } else if (id === "chats") {
      onNavigate?.("history");
    } else if (id === "new-chat" || id === "search") {
      onNavigate?.("chat");
    }
  };

  // Determine which sidebar item should be active
  const isItemActive = (itemId: string) => {
    if (itemId === "models") {
      return currentView === "models";
    }
    if (itemId === "chats") {
      return currentView === "history";
    }
    // Only "new-chat" is active when in chat view
    if (itemId === "new-chat") {
      return currentView === "chat";
    }
    return false;
  };

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-black border-r border-white/10 flex flex-col p-4">
      {/* Logo area - Updated gradient to use theme purple */}
      <div className="mb-8 px-3">
        <h2 className="text-2xl font-bold font-anton bg-linear-to-r from-purple-accent to-white/80 bg-clip-text text-transparent">
          Solyn
        </h2>
      </div>

      {/* Navigation items */}
      <nav className="flex-1 space-y-1">
        {NAVIGATION_ITEMS.map((item) => (
          <SidebarItem
            key={item.id}
            icon={<item.icon size={20} />}
            label={item.label}
            active={isItemActive(item.id)}
            onClick={() => handleNavigation(item.id)}
          />
        ))}
        <div className="pt-4 mt-4 border-t border-white/10">
          {FOOTER_ITEMS.map((item) => (
            <SidebarItem
              key={item.id}
              icon={<item.icon size={20} />}
              label={item.label}
              disabled={item.disabled}
            />
          ))}
        </div>
      </nav>

      {/* Bottom section */}
      <div className="mt-auto pt-4 border-t border-white/10">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-sm text-white/40">v0.1.0</span>
          <OllamaVersionIndicator />
        </div>
      </div>
    </aside>
  );
};
