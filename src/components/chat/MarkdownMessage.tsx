import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeSanitize from "rehype-sanitize";
import rehypeSlug from "rehype-slug";
import { createHighlighter, type Highlighter } from "shiki";
import "katex/dist/katex.min.css";

interface MarkdownMessageProps {
  content: string;
  isUser?: boolean;
}

export const MarkdownMessage = ({
  content,
  isUser = false,
}: MarkdownMessageProps) => {
  const [highlighter, setHighlighter] = useState<Highlighter | null>(null);

  useEffect(() => {
    createHighlighter({
      themes: ["github-dark"],
      langs: [
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
      ],
    }).then(setHighlighter);
  }, []);

  if (isUser) {
    return <div className="text-sm whitespace-pre-wrap">{content}</div>;
  }

  return (
    <div className="markdown-content prose prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[
          rehypeKatex,
          [
            rehypeSanitize,
            {
              attributes: {
                "*": ["style", "className", "class", "data-*"],
                span: ["style", "class"],
                pre: ["style", "class"],
                code: ["style", "class"],
              },
              strip: [],
            },
          ],
          rehypeSlug,
        ]}
        components={{
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || "");
            const lang = match ? match[1] : "";
            const codeContent = String(children).replace(/\n$/, "");

            // Check if this is inline code by looking at the parent node
            // @ts-ignore - ReactMarkdown passes this internally
            const isInline = props.inline || false;

            // If it's inline code or we don't have a highlighter yet
            if (isInline || !highlighter || !lang) {
              return isInline ? (
                <code className={className} {...props}>
                  {children}
                </code>
              ) : (
                <pre className={className}>
                  <code className={className} {...props}>
                    {children}
                  </code>
                </pre>
              );
            }

            try {
              // Use Shiki to highlight the code
              const html = highlighter.codeToHtml(codeContent, {
                lang,
                theme: "github-dark",
              });

              return (
                <div
                  className="shiki-container"
                  data-language={lang}
                  dangerouslySetInnerHTML={{ __html: html }}
                />
              );
            } catch (error) {
              console.warn(
                `Failed to highlight code for language: ${lang}`,
                error,
              );
              return (
                <pre className={className}>
                  <code className={className} {...props}>
                    {children}
                  </code>
                </pre>
              );
            }
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
