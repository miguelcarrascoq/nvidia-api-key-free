'use client';

import { Check, Copy } from 'lucide-react';
import {
  Children,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function extractText(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (isValidElement<{ children?: ReactNode }>(node)) {
    return extractText(node.props.children);
  }
  return '';
}

function languageFromClassName(className?: string): string | undefined {
  const match = /language-([^\s]+)/.exec(className ?? '');
  return match?.[1];
}

function CopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      className="markdown-copy-btn"
      aria-label={copied ? 'Copied' : 'Copy code'}
      onClick={handleCopy}
    >
      {copied ? <Check /> : <Copy />}
    </Button>
  );
}

function CodeBlock({ code, language }: { code: string; language?: string }) {
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    if (!language) {
      setHtml(null);
      return;
    }

    let cancelled = false;

    async function highlight() {
      try {
        const { codeToHtml } = await import('shiki');
        const result = await codeToHtml(code, {
          lang: language!,
          theme: 'github-dark',
        });
        if (!cancelled) setHtml(result);
      } catch {
        if (!cancelled) setHtml(null);
      }
    }

    void highlight();
    return () => {
      cancelled = true;
    };
  }, [code, language]);

  return (
    <div className="markdown-code-block">
      <CopyButton code={code} />
      {html ? (
        <div
          className="markdown-code-highlight"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <pre>
          <code className={language ? `language-${language}` : undefined}>{code}</code>
        </pre>
      )}
    </div>
  );
}

let mermaidModule: Promise<typeof import('mermaid').default> | null = null;

function loadMermaid() {
  if (!mermaidModule) {
    mermaidModule = import('mermaid').then((mod) => {
      mod.default.initialize({
        startOnLoad: false,
        theme: 'dark',
        securityLevel: 'strict',
        // Never inject Mermaid's bomb / "Syntax error in text" SVG into the page.
        suppressErrorRendering: true,
      });
      return mod.default;
    });
  }
  return mermaidModule;
}

function isMermaidErrorSvg(svg: string): boolean {
  // Theme CSS always mentions ".error-icon" — only treat real error diagrams as failures.
  return (
    svg.includes('Syntax error in text') ||
    /aria-roledescription\s*=\s*["']error["']/.test(svg)
  );
}

function MermaidBlock({ code }: { code: string }) {
  const reactId = useId().replace(/:/g, '');
  const renderCount = useRef(0);
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function renderDiagram() {
      if (!code.trim()) {
        setSvg(null);
        setError(false);
        return;
      }

      try {
        const mermaid = await loadMermaid();
        renderCount.current += 1;
        const { svg: rendered } = await mermaid.render(
          `mermaid-${reactId}-${renderCount.current}`,
          code,
        );
        if (cancelled) return;

        if (isMermaidErrorSvg(rendered)) {
          setSvg(null);
          setError(true);
          return;
        }

        setSvg(rendered);
        setError(false);
      } catch {
        if (!cancelled) {
          setSvg(null);
          setError(true);
        }
      }
    }

    void renderDiagram();
    return () => {
      cancelled = true;
    };
  }, [code, reactId]);

  if (svg) {
    return (
      <div className="markdown-mermaid">
        <CopyButton code={code} />
        <div
          className="markdown-mermaid-svg"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>
    );
  }

  return (
    <div className="markdown-mermaid-fallback">
      {error ? (
        <p className="markdown-mermaid-error">Diagram could not be rendered — showing source</p>
      ) : null}
      <CodeBlock code={code} language="mermaid" />
    </div>
  );
}

type MarkdownContentProps = {
  content: string;
  className?: string;
};

export function MarkdownContent({ content, className }: MarkdownContentProps) {
  if (!content) return null;

  return (
    <div className={cn('markdown-body', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          pre: ({ children }) => {
            const child = Children.toArray(children)[0];
            const codeClassName =
              isValidElement<{ className?: string }>(child)
                ? child.props.className
                : undefined;
            const language = languageFromClassName(codeClassName);
            const code = extractText(children).replace(/\n$/, '');

            if (language === 'mermaid') {
              return <MermaidBlock code={code} />;
            }

            return <CodeBlock code={code} language={language} />;
          },
          code: ({ className: codeClassName, children, ...props }) => {
            const isBlock =
              Children.toArray(children).some(
                (child) => typeof child === 'string' && child.includes('\n'),
              ) || Boolean(codeClassName?.includes('language-'));

            if (isBlock) {
              return (
                <code className={codeClassName} {...props}>
                  {children}
                </code>
              );
            }

            return (
              <code className={cn('markdown-inline-code', codeClassName)} {...props}>
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
