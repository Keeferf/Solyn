// src/contexts/OllamaContext.tsx
import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { invoke } from "@tauri-apps/api/core";

interface OllamaContextType {
  isOllamaInstalled: boolean | null;
  ollamaVersion: string | null;
  loading: boolean;
  refreshOllamaStatus: () => Promise<void>;
}

const OllamaContext = createContext<OllamaContextType | undefined>(undefined);

export const OllamaProvider = ({ children }: { children: ReactNode }) => {
  const [isOllamaInstalled, setIsOllamaInstalled] = useState<boolean | null>(
    null,
  );
  const [ollamaVersion, setOllamaVersion] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshOllamaStatus = async () => {
    setLoading(true);
    try {
      const installed = await invoke<boolean>("check_ollama_installed");
      setIsOllamaInstalled(installed);

      if (installed) {
        const version = await invoke<string>("get_ollama_version");
        setOllamaVersion(version);
      } else {
        setOllamaVersion(null);
      }
    } catch (error) {
      console.error("Failed to check Ollama status:", error);
      setIsOllamaInstalled(false);
      setOllamaVersion(null);
    } finally {
      setLoading(false);
    }
  };

  // Check Ollama status when the app launches
  useEffect(() => {
    refreshOllamaStatus();
  }, []);

  return (
    <OllamaContext.Provider
      value={{ isOllamaInstalled, ollamaVersion, loading, refreshOllamaStatus }}
    >
      {children}
    </OllamaContext.Provider>
  );
};

export const useOllama = () => {
  const context = useContext(OllamaContext);
  if (!context) {
    throw new Error("useOllama must be used within an OllamaProvider");
  }
  return context;
};
