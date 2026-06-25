import { SidebarItem } from "./SidebarItem";
import { NAVIGATION_ITEMS, FOOTER_ITEMS } from "./SidebarNavigation";

export const Sidebar = () => {
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
        {NAVIGATION_ITEMS.map((item) => (
          <SidebarItem
            key={item.id}
            icon={<item.icon size={20} />}
            label={item.label}
            active={item.active}
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
        <div className="px-3 py-2 text-sm text-white/40">v0.1.0</div>
      </div>
    </aside>
  );
};
