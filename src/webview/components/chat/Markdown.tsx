import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import type { Components } from 'react-markdown'

const components: Components = {
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em>{children}</em>,
  a: ({ href, children }) => (
    <a
      href={href}
      className="text-[var(--vscode-textLink-foreground,#3794ff)] underline decoration-[var(--vscode-textLink-foreground,#3794ff)]/30 hover:decoration-[var(--vscode-textLink-foreground,#3794ff)]"
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  ),
  ul: ({ children }) => <ul className="mb-2 ml-4 list-disc last:mb-0">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2 ml-4 list-decimal last:mb-0">{children}</ol>,
  li: ({ children, className }) => {
    const isTask = className === 'task-list-item'
    return (
      <li className={isTask ? 'mb-0.5 flex items-start gap-1.5 list-none' : 'mb-0.5'}>
        {children}
      </li>
    )
  },
  input: ({ checked }) => (
    <input
      type="checkbox"
      checked={checked}
      readOnly
      className="mt-0.5 size-3.5 rounded accent-primary"
    />
  ),
  h1: ({ children }) => <h1 className="mb-2 text-lg font-semibold">{children}</h1>,
  h2: ({ children }) => <h2 className="mb-2 text-base font-semibold">{children}</h2>,
  h3: ({ children }) => <h3 className="mb-1.5 text-sm font-semibold">{children}</h3>,
  blockquote: ({ children }) => (
    <blockquote className="mb-2 border-l-2 border-muted-foreground/30 pl-3 text-muted-foreground last:mb-0">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-3 border-border/40" />,
  table: ({ children }) => (
    <div className="mb-2 overflow-x-auto rounded-md border border-border/30 last:mb-0">
      <table className="min-w-full border-collapse text-[12px]">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="border-b border-border/40 bg-muted/20">{children}</thead>
  ),
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => (
    <tr className="border-b border-border/20 last:border-0 even:bg-muted/10">{children}</tr>
  ),
  th: ({ children }) => (
    <th className="px-3 py-1.5 text-left font-semibold text-muted-foreground">{children}</th>
  ),
  td: ({ children }) => <td className="px-3 py-1.5">{children}</td>,
  code: ({ className, children }) => {
    const isBlock = className?.startsWith('language-')
    if (isBlock) {
      return (
        <div className="mb-2 overflow-hidden rounded-md border border-border/30 last:mb-0">
          <pre className="overflow-x-auto bg-muted/10 p-3">
            <code className="font-mono text-[12px] leading-relaxed text-foreground/85">
              {children}
            </code>
          </pre>
        </div>
      )
    }
    return (
      <code className="rounded bg-muted/30 px-1 py-0.5 font-mono text-[0.9em] text-foreground/90">
        {children}
      </code>
    )
  },
  pre: ({ children }) => <>{children}</>,
}

interface MarkdownProps {
  content: string
}

export function Markdown({ content }: MarkdownProps): React.JSX.Element {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={components}>
      {content}
    </ReactMarkdown>
  )
}
