import {
  FiPlus,
  FiSearch,
  FiMessageSquare,
  FiMoreHorizontal,
} from "react-icons/fi";

export const NAVIGATION_ITEMS = [
  { id: "new-chat", icon: FiPlus, label: "New Chat", active: true },
  { id: "search", icon: FiSearch, label: "Search" },
  { id: "chats", icon: FiMessageSquare, label: "Chats" },
];

export const FOOTER_ITEMS = [
  {
    id: "more",
    icon: FiMoreHorizontal,
    label: "More features coming",
    disabled: true,
  },
];
