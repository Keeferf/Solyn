// src/components/models/utils/terminalUtils.ts
export interface TerminalOutput {
  line: string;
  stream: string;
}

export const shouldShowLine = (line: string): boolean => {
  // Filter out PowerShell VERBOSE messages
  if (line.includes("VERBOSE:")) return false;

  // Filter out specific verbose messages
  if (line.includes("GET with") && line.includes("payload")) return false;
  if (line.includes("received") && line.includes("response of content type"))
    return false;

  // Filter out "Install complete" messages
  if (line.includes("Install complete. Run 'ollama' from the command line."))
    return false;
  if (line.includes("Run 'ollama' from the command line.")) return false;
  if (line.includes("Install complete.")) return false;

  // Filter out empty lines
  if (line.trim() === "") return false;

  return true;
};

export const getStreamColor = (stream: string): string => {
  const colorMap: Record<string, string> = {
    stdout: "text-white/70",
    stderr: "text-yellow-400/70",
    info: "text-blue-400/70",
    success: "text-green-400/70",
  };
  return colorMap[stream] || "text-white/70";
};

export const getStreamPrefix = (stream: string): string => {
  const prefixMap: Record<string, string> = {
    stdout: ">",
    stderr: "!",
    info: "ℹ",
    success: "✓",
  };
  return prefixMap[stream] || "$";
};
