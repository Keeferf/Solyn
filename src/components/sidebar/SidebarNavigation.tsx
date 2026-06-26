// src/components/sidebar/SidebarNavigation.tsx
import {
  FiPlus,
  FiSearch,
  FiMessageSquare,
  FiMoreHorizontal,
  FiLayers,
} from "react-icons/fi";

export const NAVIGATION_ITEMS = [
  { id: "new-chat", icon: FiPlus, label: "New Chat" },
  { id: "search", icon: FiSearch, label: "Search" },
  { id: "chats", icon: FiMessageSquare, label: "Chats" },
  { id: "models", icon: FiLayers, label: "Models" },
];

export const FOOTER_ITEMS = [
  {
    id: "more",
    icon: FiMoreHorizontal,
    label: "More features coming",
    disabled: true,
  },
];
