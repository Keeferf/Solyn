import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { FiRefreshCw, FiAlertCircle } from "react-icons/fi";
import { useOllama } from "@/contexts/OllamaContext";

interface OllamaStatus {
  installed: boolean;
  running: boolean;
  version: string | null;
}

export const OllamaVersionIndicator = () => {
  const { status, refreshOllamaStatus } = useOllama();
  const [isOutdated, setIsOutdated] = useState(false);
  const [checking, setChecking] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);

  // Check for updates whenever the status changes
  useEffect(() => {
    if (status?.running && status?.version) {
      checkForUpdates(status.version);
    } else {
      setIsOutdated(false);
      setLatestVersion(null);
    }
  }, [status?.running, status?.version]);

  // Listen for status updates from the backend
  useEffect(() => {
    const unlisten = listen<OllamaStatus>("ollama-status-update", (event) => {
      if (event.payload.running && event.payload.version) {
        checkForUpdates(event.payload.version);
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const checkForUpdates = async (currentVersion: string) => {
    if (checking) return;

    setChecking(true);

    try {
      const response = await fetch(
        "https://api.github.com/repos/ollama/ollama/releases/latest",
      );

      if (!response.ok) {
        throw new Error("Failed to fetch latest version");
      }

      const data = await response.json();
      const latest = data.tag_name.replace("v", "");
      setLatestVersion(latest);

      const isOutdated = compareVersions(currentVersion, latest) < 0;
      setIsOutdated(isOutdated);

      if (isOutdated) {
        console.log(`Update available: ${currentVersion} → ${latest}`);
      }
    } catch (error) {
      console.error("Failed to check Ollama updates:", error);
      setIsOutdated(false);
    } finally {
      setChecking(false);
    }
  };

  const compareVersions = (v1: string, v2: string): number => {
    const parts1 = v1.split(".").map(Number);
    const parts2 = v2.split(".").map(Number);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const num1 = parts1[i] || 0;
      const num2 = parts2[i] || 0;

      if (num1 !== num2) {
        return num1 - num2;
      }
    }

    return 0;
  };

  const handleUpdate = async () => {
    if (!isOutdated) return;

    setUpdating(true);

    try {
      console.log("Starting Ollama update...");
      await invoke("update_ollama");

      // Refresh the status after update
      await refreshOllamaStatus();

      console.log("Ollama update completed successfully");
    } catch (error) {
      console.error("Failed to update Ollama:", error);
    } finally {
      setUpdating(false);
    }
  };

  // Only show when there's an update available
  if (!isOutdated || !status?.installed || !status?.running) {
    return null;
  }

  // Show update button
  return (
    <button
      onClick={handleUpdate}
      disabled={updating}
      className="flex items-center gap-1.5 px-2 py-1 bg-success-bg border border-success-border rounded-lg hover:bg-success-bg/50 transition-all group cursor-pointer text-xs"
      title={`Update Ollama from ${status.version} to ${latestVersion}`}
    >
      <FiAlertCircle className="w-3 h-3 text-success shrink-0" />
      <span className="font-medium text-success">
        {updating ? "Updating..." : `Update to ${latestVersion}`}
      </span>
      {updating && (
        <FiRefreshCw className="w-3 h-3 text-success animate-spin shrink-0" />
      )}
    </button>
  );
};
