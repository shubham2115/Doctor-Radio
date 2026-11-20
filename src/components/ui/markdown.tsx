"use client";
import { useRef } from "react";
import ReactMarkdown from "react-markdown";
import { Bold, Code, Italic, Link2, List, Quote } from "lucide-react";
import { Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Safe markdown: react-markdown never renders raw HTML and sanitises URLs (javascript: etc.),
 * so user content cannot inject script. @mentions become profile links.
 */
export function Markdown({ children, className }: { children: string; className?: string }) {
  const withMentions = children.replace(/(^|\s)@([a-z0-9_]{3,30})\b/g, "$1[@$2](/u/$2)");
  return (
    <div className={cn("prose-sm max-w-none text-sm leading-relaxed [&_a]:text-accent [&_a]:underline-offset-2 hover:[&_a]:underline [&_code]:rounded [&_code]:bg-surface-2 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[12px] [&_h1]:mt-3 [&_h1]:text-base [&_h1]:font-semibold [&_h2]:mt-3 [&_h2]:text-[15px] [&_h2]:font-semibold [&_h3]:mt-2 [&_h3]:font-semibold [&_li]:my-0.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1.5 [&_blockquote]:border-l-2 [&_blockquote]:border-accent [&_blockquote]:pl-3 [&_blockquote]:text-muted [&_table]:my-2 [&_table]:w-full [&_table]:text-xs [&_td]:border [&_td]:border-border [&_td]:p-1.5 [&_th]:border [&_th]:border-border [&_th]:bg-surface-2 [&_th]:p-1.5 [&_th]:text-left [&_ul]:list-disc [&_ul]:pl-5", className)}>
      <ReactMarkdown
        components={{ a: ({ href, children: c }) => <a href={href} target={href?.startsWith("/") ? undefined : "_blank"} rel="noopener noreferrer nofollow">{c}</a> }}
      >
        {withMentions}
      </ReactMarkdown>
    </div>
  );
}

type Props = Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange" | "value"> & { value: string; onChange: (v: string) => void };

/** Textarea with a light rich-text toolbar that inserts markdown syntax. */
export function MarkdownEditor({ value, onChange, className, ...rest }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  function wrap(before: string, after = before, placeholder = "text") {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const sel = value.slice(s, e) || placeholder;
    onChange(value.slice(0, s) + before + sel + after + value.slice(e));
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + before.length, s + before.length + sel.length); });
  }
  const linePrefix = (p: string) => {
    const el = ref.current;
    if (!el) return;
    const s = value.lastIndexOf("\n", el.selectionStart - 1) + 1;
    onChange(value.slice(0, s) + p + value.slice(s));
  };

  const btn = "rounded-md p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-fg";
  return (
    <div className="rounded-[10px] border border-border bg-surface focus-within:border-accent focus-within:ring-4 focus-within:ring-[var(--ring)]">
      <div className="flex gap-0.5 border-b border-border px-1.5 py-1">
        <button type="button" className={btn} aria-label="Bold" onClick={() => wrap("**")}><Bold className="h-3.5 w-3.5" /></button>
        <button type="button" className={btn} aria-label="Italic" onClick={() => wrap("*")}><Italic className="h-3.5 w-3.5" /></button>
        <button type="button" className={btn} aria-label="Bulleted list" onClick={() => linePrefix("- ")}><List className="h-3.5 w-3.5" /></button>
        <button type="button" className={btn} aria-label="Quote" onClick={() => linePrefix("> ")}><Quote className="h-3.5 w-3.5" /></button>
        <button type="button" className={btn} aria-label="Code" onClick={() => wrap("`")}><Code className="h-3.5 w-3.5" /></button>
        <button type="button" className={btn} aria-label="Link" onClick={() => wrap("[", "](https://)", "link text")}><Link2 className="h-3.5 w-3.5" /></button>
        <span className="ml-auto self-center pr-2 text-[11px] text-subtle">Markdown · @mention</span>
      </div>
      <Textarea ref={ref} value={value} onChange={(e) => onChange(e.target.value)} className={cn("min-h-20 rounded-none border-0 shadow-none focus:ring-0", className)} {...rest} />
    </div>
  );
}
