import { useEffect, useState } from "react";
import { createHighlighter, type Highlighter } from "shiki";
import { useThemeStore } from "@/stores/themeStore";

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
  const { theme } = useThemeStore();

  useEffect(() => {
    let isMounted = true;

    createHighlighter({
      themes: [theme],
      langs: SUPPORTED_LANGUAGES,
    }).then((hl) => {
      if (isMounted) {
        setHighlighter(hl);
      }
    });

    return () => {
      isMounted = false;
      setHighlighter(null);
    };
  }, [theme]);

  return highlighter;
};
