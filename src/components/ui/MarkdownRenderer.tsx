'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export default function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  return (
    <div className={`markdown-content ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Headers with modern styling
          h1: ({ children }) => (
            <h1 className="text-lg font-bold mb-3 text-primary-900 dark:text-primary-100 border-b border-primary-200 dark:border-primary-600 pb-2">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-base font-bold mb-2 text-primary-900 dark:text-primary-100">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-sm font-semibold mb-2 text-primary-800 dark:text-primary-200">
              {children}
            </h3>
          ),
          
          // Paragraphs with proper spacing
          p: ({ children }) => (
            <p className="mb-3 last:mb-0 leading-relaxed text-primary-700 dark:text-primary-300">
              {children}
            </p>
          ),
          
          // Text formatting
          strong: ({ children }) => (
            <strong className="font-semibold text-primary-900 dark:text-primary-100">
              {children}
            </strong>
          ),
          em: ({ children }) => (
            <em className="italic text-primary-700 dark:text-primary-300">
              {children}
            </em>
          ),
          
          // Lists with better styling
          ul: ({ children }) => (
            <ul className="list-disc list-outside mb-3 space-y-1 ml-4">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-outside mb-3 space-y-1 ml-4">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="text-primary-700 dark:text-primary-300 leading-relaxed">
              {children}
            </li>
          ),
          
          // Code blocks with syntax highlighting
          code: ({ className, children, ...props }: any) => {
            const isInline = !className?.includes('language-');
            return isInline ? (
              <code 
                className="bg-primary-100 dark:bg-primary-700 text-primary-800 dark:text-primary-200 px-1.5 py-0.5 rounded text-sm font-mono border border-primary-200 dark:border-primary-600" 
                {...props}
              >
                {children}
              </code>
            ) : (
              <pre className="bg-primary-100 dark:bg-primary-700 text-primary-800 dark:text-primary-200 p-4 rounded-xl overflow-x-auto my-3 border border-primary-200 dark:border-primary-600">
                <code className="font-mono text-sm leading-relaxed" {...props}>
                  {children}
                </code>
              </pre>
            );
          },
          
          // Blockquotes with accent
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-accent-400 dark:border-accent-500 bg-accent-50 dark:bg-accent-900/20 pl-4 pr-4 py-2 my-3 rounded-r-lg italic text-primary-700 dark:text-primary-300">
              {children}
            </blockquote>
          ),
          
          // Links with hover effects
          a: ({ href, children }) => (
            <a
              href={href}
              className="text-accent-600 dark:text-accent-400 hover:text-accent-700 dark:hover:text-accent-300 underline underline-offset-2 decoration-2 transition-colors duration-200"
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          ),
          
          // Tables with modern styling
          table: ({ children }) => (
            <div className="overflow-x-auto my-4 rounded-lg border border-primary-200 dark:border-primary-600">
              <table className="min-w-full bg-white dark:bg-primary-800">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-primary-50 dark:bg-primary-700">
              {children}
            </thead>
          ),
          th: ({ children }) => (
            <th className="border-b border-primary-200 dark:border-primary-600 px-4 py-3 text-left font-semibold text-sm text-primary-900 dark:text-primary-100">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-b border-primary-100 dark:border-primary-700 px-4 py-3 text-sm text-primary-700 dark:text-primary-300">
              {children}
            </td>
          ),
          
          // Horizontal rules
          hr: () => (
            <hr className="my-6 border-t border-primary-200 dark:border-primary-600" />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}