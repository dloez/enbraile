import { useEffect, useMemo, useState } from "react";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { readPage } from "@/components/page";
import { cn } from "@/lib/utils";

interface MdNode {
  type: string;
  depth?: number;
  value?: string;
  children?: MdNode[];
  data?: { hProperties?: Record<string, string> };
}

interface Entry {
  id: string;
  text: string;
  depth: number;
}

const SOURCE = "https://github.com/dloez/enbraile/blob/main/docs/pkmn/series/1/reference/rules.md";

function slug(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .replace(/\s/g, "-");
}

function target(href: string | undefined): { href: string | undefined; away: boolean } {
  if (!href || href.startsWith("#")) return { href, away: false };
  if (/^[a-z]+:/i.test(href)) return { href, away: true };
  return { href: new URL(href, SOURCE).href, away: true };
}

function textOf(node: MdNode): string {
  return node.value ?? (node.children ?? []).map(textOf).join("");
}

function ids() {
  const taken = new Map<string, number>();
  return (text: string) => {
    const base = slug(text) || "section";
    const n = taken.get(base) ?? 0;
    taken.set(base, n + 1);
    return n === 0 ? base : `${base}-${n}`;
  };
}

function headingIds() {
  return (tree: MdNode) => {
    const next = ids();
    const walk = (node: MdNode) => {
      if (node.type === "heading" && (node.depth === 2 || node.depth === 3)) {
        node.data = { ...node.data, hProperties: { ...node.data?.hProperties, id: next(textOf(node)) } };
      }
      node.children?.forEach(walk);
    };
    walk(tree);
  };
}

function contents(rules: string): Entry[] {
  const next = ids();
  const entries: Entry[] = [];
  let fenced = false;
  for (const line of rules.split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
    const match = !fenced && /^(#{2,3})\s+(.+?)\s*#*\s*$/.exec(line);
    if (!match) continue;
    const text = match[2].replace(/[*_`]/g, "");
    entries.push({ id: next(text), text, depth: match[1].length });
  }
  return entries;
}

const RULES: Components = {
  h1: ({ children }) => <h3 className="m-0 mb-3 font-heading text-4xl font-normal text-white">{children}</h3>,
  h2: ({ children, id }) => <h4 id={id} className="scroll-mt-4 m-0 mt-5 mb-1 font-heading text-[1.5625rem] font-normal text-primary first:mt-0 sm:text-3xl">{children}</h4>,
  h3: ({ children, id }) => <h5 id={id} className="scroll-mt-4 m-0 mt-4 mb-1 font-heading text-2xl font-normal text-primary">{children}</h5>,
  h4: ({ children }) => <h6 className="m-0 mt-3 mb-1 font-heading text-xl font-normal text-subtle">{children}</h6>,
  p: ({ children }) => <p className="m-0 mb-3">{children}</p>,
  ul: ({ children }) => <ul className="m-0 mb-3 list-disc pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="m-0 mb-3 list-decimal pl-5">{children}</ol>,
  li: ({ children }) => <li className="mb-1.5">{children}</li>,
  a: ({ children, href }) => {
    const link = target(href);
    return (
      <a
        href={link.href}
        target={link.away ? "_blank" : undefined}
        rel={link.away ? "noreferrer" : undefined}
        className="text-primary underline underline-offset-2"
      >
        {children}
      </a>
    );
  },
  strong: ({ children }) => <strong className="font-extrabold text-white">{children}</strong>,
  code: ({ children }) => <code className="rounded-sm bg-muted px-1 text-base">{children}</code>,
  blockquote: ({ children }) => <blockquote className="m-0 mb-3 border-l-3 border-cell-hi pl-3.5 text-subtle">{children}</blockquote>,
  table: ({ children }) => (
    <div className="mb-3 overflow-x-auto break-inside-avoid">
      <table className="w-full border-collapse text-base">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border-b-3 px-2 py-1 text-left font-bold">{children}</th>,
  td: ({ children }) => <td className="border-b px-2 py-1 align-top">{children}</td>,
  hr: () => <hr className="my-4 border-t-3 border-cell" />,
};

function Index({ entries, active, className }: { entries: Entry[]; active: string | null; className?: string }) {
  return (
    <ol className={cn("m-0 flex list-none flex-col gap-0.5 p-0", className)}>
      {entries.map((entry) => (
        <li key={entry.id}>
          <a
            href={`#${entry.id}`}
            aria-current={entry.id === active ? "location" : undefined}
            className={cn(
              "block rounded-lg py-1.5 pr-2 leading-snug outline-none hover:bg-cell hover:text-white focus-visible:ring-3 focus-visible:ring-ring/50",
              entry.depth === 2 ? "pl-2.5 font-heading text-xl" : "pl-6 text-sm font-bold",
              entry.id === active ? "bg-cell text-white" : entry.depth === 2 ? "text-subtle" : "text-muted-foreground",
            )}
          >
            {entry.text}
          </a>
        </li>
      ))}
    </ol>
  );
}

export function Rules({ rules }: { rules: string }) {
  const entries = useMemo(() => contents(rules), [rules]);
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    const targets = entries.map((entry) => document.getElementById(entry.id)).filter((el): el is HTMLElement => el !== null);
    if (targets.length === 0) return;
    const update = () => {
      let current: string | null = null;
      for (const el of targets) if (el.getBoundingClientRect().top <= 120) current = el.id;
      setActive(current ?? targets[0].id);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, [entries]);
  if (rules.trim() === "") return null;
  return (
    <section aria-labelledby="rules-title" className={cn(readPage, "flex-none gap-3 pt-2 pb-10 sm:gap-3.5 sm:pb-14")}>
      <h2 id="rules-title" className="m-0 font-heading text-[2.125rem] font-normal sm:text-4xl">
        Rules
      </h2>
      <div className="flex items-start gap-6 xl:gap-8">
        {entries.length > 0 && (
          <nav
            aria-label="Rules contents"
            className="sticky top-4 hidden max-h-[calc(100svh-2rem)] w-72 flex-none overflow-y-auto rounded-2xl border-3 bg-card p-2.5 [scrollbar-color:var(--cell-hi)_transparent] [scrollbar-width:thin] lg:block"
          >
            <Index entries={entries} active={active} />
          </nav>
        )}
        <div className="min-w-0 flex-1 rounded-2xl border-3 bg-card px-4.5 pt-4.5 pb-1 text-base leading-relaxed sm:px-8 sm:py-6.5 sm:text-lg">
          {entries.length > 0 && (
            <details className="mb-4 rounded-xl border-3 bg-box lg:hidden">
              <summary className="min-h-11 cursor-pointer list-inside px-3.5 py-2 font-heading text-[1.375rem] text-subtle">Contents</summary>
              <Index entries={entries} active={null} className="px-1.5 pb-2" />
            </details>
          )}
          <div>
            <Markdown remarkPlugins={[remarkGfm, headingIds]} skipHtml components={RULES}>
              {rules}
            </Markdown>
          </div>
        </div>
      </div>
    </section>
  );
}
