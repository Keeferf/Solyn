import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { FiMinus, FiMaximize, FiX } from "react-icons/fi";

const appWindow = getCurrentWindow();

export const TitleBar = () => {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    const checkMaximized = async () => {
      try {
        const maximized = await appWindow.isMaximized();
        setIsMaximized(maximized);
      } catch (error) {
        console.error("Failed to check maximized state:", error);
      }
    };

    checkMaximized();

    const unlisten = appWindow.onResized(() => {
      appWindow.isMaximized().then(setIsMaximized).catch(console.error);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const handleMinimize = async () => {
    try {
      await appWindow.minimize();
    } catch (error) {
      console.error("Failed to minimize:", error);
    }
  };

  const handleMaximize = async () => {
    try {
      await appWindow.toggleMaximize();
    } catch (error) {
      console.error("Failed to toggle maximize:", error);
    }
  };

  const handleClose = async () => {
    try {
      await appWindow.close();
    } catch (error) {
      console.error("Failed to close:", error);
    }
  };

  return (
    <div
      data-tauri-drag-region
      className="fixed top-0 left-0 right-0 h-10 bg-black flex items-center justify-between px-3 z-50 select-none border-b border-white/5"
    >
      <div className="flex items-center gap-2" data-tauri-drag-region>
        <span className="text-[#d8d4cf] font-anton text-sm tracking-wider">
          Solyn
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          onClick={handleMinimize}
          className="w-3.5 h-3.5 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
          aria-label="Minimize"
          data-tauri-drag-region="false"
        >
          <FiMinus className="w-2.5 h-2.5 text-[#d8d4cf]" strokeWidth={2} />
        </button>
        <button
          onClick={handleMaximize}
          className="w-3.5 h-3.5 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
          aria-label="Maximize"
          data-tauri-drag-region="false"
        >
          <FiMaximize
            className={`w-2.5 h-2.5 text-[#d8d4cf] transition-transform ${isMaximized ? "rotate-180" : ""}`}
            strokeWidth={2}
          />
        </button>
        <button
          onClick={handleClose}
          className="w-3.5 h-3.5 rounded-full bg-white/5 hover:bg-red-500 flex items-center justify-center transition-colors group"
          aria-label="Close"
          data-tauri-drag-region="false"
        >
          <FiX
            className="w-2.5 h-2.5 text-[#d8d4cf] group-hover:text-white transition-colors"
            strokeWidth={2}
          />
        </button>
      </div>
    </div>
  );
};
