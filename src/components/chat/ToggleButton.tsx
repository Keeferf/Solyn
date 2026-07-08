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
          ? "bg-purple-accent/20 hover:bg-purple-accent/30 text-purple-accent"
          : "text-purple-accent/40 hover:text-purple-accent/60 bg-transparent hover:bg-white/5"
      }`}
    >
      {icon}
    </button>
  );
};
