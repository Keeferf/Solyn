import { useState } from "react";
import { FiCopy, FiCheck } from "react-icons/fi";
import { type Highlighter } from "shiki";

interface CodeBlockProps {
  className?: string;
  children: React.ReactNode;
  highlighter: Highlighter | null;
  inline?: boolean;
}

export const CodeBlock = ({
  className,
  children,
  highlighter,
  inline = false,
}: CodeBlockProps) => {
  const [copied, setCopied] = useState(false);

  const match = /language-(\w+)/.exec(className || "");
  const lang = match ? match[1] : "";
  const codeContent = String(children).replace(/\n$/, "");

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(codeContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn("Failed to copy code:", err);
    }
  };

  // If it's inline code
  if (inline || !highlighter || !lang) {
    return inline ? (
      <code className={className}>{children}</code>
    ) : (
      <div className="shiki-wrapper">
        <div className="shiki-header">
          <span className="shiki-language">{lang || "code"}</span>
          <button
            onClick={handleCopy}
            className="shiki-copy-button"
            aria-label="Copy code"
          >
            {copied ? (
              <>
                <FiCheck size={14} />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <FiCopy size={14} />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
        <div className="shiki-container shiki-container-fallback">
          <pre className={className}>
            <code className={className}>{children}</code>
          </pre>
        </div>
      </div>
    );
  }

  try {
    // Use Shiki to highlight the code
    const html = highlighter.codeToHtml(codeContent, {
      lang,
      theme: "github-dark",
    });

    return (
      <div className="shiki-wrapper">
        <div className="shiki-header">
          <span className="shiki-language">{lang}</span>
          <button
            onClick={handleCopy}
            className="shiki-copy-button"
            aria-label="Copy code"
          >
            {copied ? (
              <>
                <FiCheck size={14} />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <FiCopy size={14} />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
        <div
          className="shiki-container"
          data-language={lang}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    );
  } catch (error) {
    console.warn(`Failed to highlight code for language: ${lang}`, error);
    return (
      <div className="shiki-wrapper">
        <div className="shiki-header">
          <span className="shiki-language">{lang}</span>
          <button
            onClick={handleCopy}
            className="shiki-copy-button"
            aria-label="Copy code"
          >
            {copied ? (
              <>
                <FiCheck size={14} />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <FiCopy size={14} />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
        <div className="shiki-container shiki-container-fallback">
          <pre className={className}>
            <code className={className}>{children}</code>
          </pre>
        </div>
      </div>
    );
  }
};
