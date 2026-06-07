import { useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
interface ChatMessageContentProps {
  content: string;
  className?: string;
}

function CopyCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [code]);

  return (
    <button
      onClick={copy}
      className="absolute top-2 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-all opacity-0 group-hover:opacity-100 bg-background/80 text-muted-foreground hover:text-foreground border border-border/50"
      title="Copy code"
    >
      {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

export function ChatMessageContent({ content, className }: ChatMessageContentProps) {
  return (
    <div
      className={cn("prose prose-sm max-w-none dark:prose-invert text-foreground", className)}
      style={{
        "--tw-prose-body": "var(--foreground)",
        "--tw-prose-headings": "var(--foreground)",
        "--tw-prose-bold": "var(--foreground)",
        "--tw-prose-code": "var(--foreground)",
        "--tw-prose-invert-body": "var(--foreground)",
        "--tw-prose-invert-headings": "var(--foreground)",
        "--tw-prose-invert-bold": "var(--foreground)",
        "--tw-prose-invert-code": "var(--foreground)",
      } as React.CSSProperties}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || "");
            const code = String(children).replace(/\n$/, "");

            if (match) {
              return (
                <div className="relative group rounded-md overflow-hidden my-2">
                  <div className="flex items-center justify-between px-3 py-1 bg-muted border-b border-border/50">
                    <span className="text-[10px] font-mono text-muted-foreground uppercase">{match[1]}</span>
                    <CopyCodeButton code={code} />
                  </div>
                  <SyntaxHighlighter
                    style={oneDark}
                    language={match[1]}
                    PreTag="div"
                    customStyle={{
                      margin: 0,
                      borderRadius: "0 0 6px 6px",
                      fontSize: "12px",
                      lineHeight: "1.5",
                    }}
                  >
                    {code}
                  </SyntaxHighlighter>
                </div>
              );
            }

            return (
              <code
                className="px-1.5 py-0.5 rounded bg-muted text-primary text-xs font-mono"
                {...props}
              >
                {children}
              </code>
            );
          },
          pre({ children }) {
            return <div className="my-1">{children}</div>;
          },
          p({ children }) {
            return <p className="m-0 mb-1.5 leading-relaxed">{children}</p>;
          },
          ul({ children }) {
            return <ul className="list-disc pl-4 mb-1.5">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="list-decimal pl-4 mb-1.5">{children}</ol>;
          },
          li({ children }) {
            return <li className="mb-0.5">{children}</li>;
          },
          a({ href, children }) {
            return (
              <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                {children}
              </a>
            );
          },
          blockquote({ children }) {
            return (
              <blockquote className="border-l-2 border-primary/30 pl-3 italic text-muted-foreground my-2">
                {children}
              </blockquote>
            );
          },
          table({ children }) {
            return (
              <div className="overflow-x-auto my-2">
                <table className="text-xs border-collapse border border-border">{children}</table>
              </div>
            );
          },
          thead({ children }) {
            return <thead className="bg-muted">{children}</thead>;
          },
          th({ children }) {
            return <th className="border border-border px-2 py-1 text-left font-semibold">{children}</th>;
          },
          td({ children }) {
            return <td className="border border-border px-2 py-1">{children}</td>;
          },
          hr() {
            return <hr className="border-border my-3" />;
          },
          h1({ children }) {
            return <h1 className="text-base font-bold mb-2 mt-1">{children}</h1>;
          },
          h2({ children }) {
            return <h2 className="text-sm font-bold mb-2 mt-2">{children}</h2>;
          },
          h3({ children }) {
            return <h3 className="text-xs font-bold mb-1 mt-2 uppercase tracking-wider text-muted-foreground">{children}</h3>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
