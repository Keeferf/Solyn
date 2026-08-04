// src/components/chat/hooks/useHighlighter.ts
import { useEffect, useState } from "react";
import { createHighlighter, type Highlighter } from "shiki";

const SUPPORTED_LANGUAGES = [
  "javascript",
  "typescript",
  "python",
  "rust",
  "go",
  "html",
  "css",
  "json",
  "yaml",
  "sql",
  "bash",
  "shell",
  "markdown",
  "xml",
  "c",
  "cpp",
  "csharp",
  "java",
  "ruby",
  "php",
  "swift",
  "kotlin",
  "dart",
  "r",
  "scala",
  "perl",
  "lua",
  "groovy",
  "powershell",
  "dockerfile",
  "nginx",
  "graphql",
];

export const useHighlighter = () => {
  const [highlighter, setHighlighter] = useState<Highlighter | null>(null);

  useEffect(() => {
    createHighlighter({
      themes: ["github-dark"],
      langs: SUPPORTED_LANGUAGES,
    }).then(setHighlighter);
  }, []);

  return highlighter;
};
