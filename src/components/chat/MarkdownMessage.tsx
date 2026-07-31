import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import rehypeSanitize from "rehype-sanitize";
import rehypeSlug from "rehype-slug";
import "highlight.js/styles/github-dark.css";
import "katex/dist/katex.min.css";

interface MarkdownMessageProps {
  content: string;
  isUser?: boolean;
}

export const MarkdownMessage = ({
  content,
  isUser = false,
}: MarkdownMessageProps) => {
  if (isUser) {
    return <div className="text-sm whitespace-pre-wrap">{content}</div>;
  }

  return (
    <div className="markdown-content prose prose-invert prose-sm max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[
          rehypeHighlight,
          rehypeKatex,
          rehypeSanitize,
          rehypeSlug,
        ]}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
