export const ToggleButton = ({
  isActive,
  onClick,
  icon,
}: {
  isActive: boolean;
  onClick: () => void;
  icon: React.ReactNode;
}) => {
  return (
    <button
      onClick={onClick}
      className={`p-2 rounded-lg transition-colors cursor-pointer ${
        isActive
          ? "bg-(--color-purple-accent)/20 hover:bg-(--color-purple-accent)/30 text-(--color-purple-accent)"
          : "text-(--color-purple-accent)/40 hover:text-(--color-purple-accent)/60 bg-transparent hover:bg-white/5"
      }`}
    >
      {icon}
    </button>
  );
};
