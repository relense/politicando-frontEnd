import Link from "next/link";
import type { ReactNode } from "react";
import { isSitePath, safeHttpUrl } from "./api/mappers";
import { SITE_URL } from "./site";

/**
 * A small Markdown renderer for our own posts, straight to React elements, so raw HTML in the text is always shown
 * as text, never run. Covers what the editors use: headings, paragraphs, lists, quotes, code, rules, tables (GFM),
 * bold, italic, inline code, links and images. Links must be http(s) or a path on this site ("/deputados"), images http(s);
 * anything else stays plain text.
 */
export function renderMarkdown(source: string, top?: number): ReactNode[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  // The page title is the h1, so the post's biggest heading becomes an h2 and the rest follow from it.
  const levels = lines.map((line) => line.match(/^(#{1,6})\s/)?.[1]!.length).filter((level): level is number => level !== undefined);
  const biggest = top ?? (levels.length > 0 ? Math.min(...levels) : 1);
  const blocks: ReactNode[] = [];
  let index = 0;
  const key = () => `b${blocks.length}`;

  while (index < lines.length) {
    const line = lines[index]!;

    if (line.trim() === "") {
      index++;
      continue;
    }

    const fence = line.match(/^```/);
    if (fence) {
      const code: string[] = [];
      index++;
      while (index < lines.length && !lines[index]!.startsWith("```")) code.push(lines[index++]!);
      index++;
      blocks.push(
        <pre key={key()}>
          <code>{code.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const level = Math.min(6, heading[1]!.length - biggest + 2);
      const Tag = `h${level}` as "h2";
      const text = heading[2]!.replace(/\s#+\s*$/, "");
      blocks.push(
        <Tag key={key()} id={level === 2 ? headingId(text) : undefined}>
          {renderInline(text)}
        </Tag>,
      );
      index++;
      continue;
    }

    if (/^(\*\s*){3,}$|^(-\s*){3,}$|^(_\s*){3,}$/.test(line.trim())) {
      blocks.push(<hr key={key()} />);
      index++;
      continue;
    }

    if (line.startsWith(">")) {
      const quote: string[] = [];
      while (index < lines.length && lines[index]!.startsWith(">")) quote.push(lines[index++]!.replace(/^>\s?/, ""));
      blocks.push(<blockquote key={key()}>{renderMarkdown(quote.join("\n"), biggest)}</blockquote>);
      continue;
    }

    // A table: a header row, a separator row of dashes (colons set the alignment), then the body rows.
    if (TABLE_ROW.test(line) && index + 1 < lines.length && TABLE_RULE.test(lines[index + 1]!)) {
      const head = cellsOf(line);
      const align = cellsOf(lines[index + 1]!).map((cell) =>
        cell.startsWith(":") && cell.endsWith(":") ? "center" : cell.endsWith(":") ? "right" : undefined,
      );
      index += 2;
      const body: string[][] = [];
      while (index < lines.length && TABLE_ROW.test(lines[index]!)) body.push(cellsOf(lines[index++]!));
      blocks.push(
        // Wide tables scroll inside their box on a phone; the page itself never does.
        <div key={key()} className="post-table" role="region" aria-label="Tabela" tabIndex={0}>
          <table>
            <thead>
              <tr>
                {head.map((cell, at) => (
                  <th key={at} scope="col" style={{ textAlign: align[at] }}>
                    {renderInline(cell)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((row, at) => (
                <tr key={at}>
                  {head.map((_, column) =>
                    column === 0 && head[0] === "" ? (
                      <th key={column} scope="row">
                        {renderInline(row[column] ?? "")}
                      </th>
                    ) : (
                      <td key={column} style={{ textAlign: align[column] }}>
                        {renderInline(row[column] ?? "")}
                      </td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    const bullet = /^\s*[-*+]\s+/;
    const numbered = /^\s*\d+[.)]\s+/;
    if (bullet.test(line) || numbered.test(line)) {
      const ordered = numbered.test(line);
      const marker = ordered ? numbered : bullet;
      const items: string[] = [];
      while (index < lines.length && lines[index]!.trim() !== "") {
        const current = lines[index]!;
        if (marker.test(current)) items.push(current.replace(marker, ""));
        else if (items.length > 0) items[items.length - 1] += ` ${current.trim()}`;
        index++;
      }
      const List = ordered ? "ol" : "ul";
      blocks.push(
        <List key={key()}>
          {items.map((item, at) => (
            <li key={at}>{renderInline(item)}</li>
          ))}
        </List>,
      );
      continue;
    }

    const paragraph: string[] = [];
    while (
      index < lines.length &&
      lines[index]!.trim() !== "" &&
      !/^(#{1,6}\s|>|```|\s*[-*+]\s|\s*\d+[.)]\s)/.test(lines[index]!) &&
      !TABLE_ROW.test(lines[index]!)
    ) {
      paragraph.push(lines[index++]!.trim());
    }
    const text = paragraph.join(" ");
    // "Fonte: …" lines name where a passage comes from: set apart, smaller, so they read as notes.
    blocks.push(
      /^Fontes?:/.test(text) ? (
        <p key={key()} className="post-source">
          {renderInline(text)}
        </p>
      ) : (
        <p key={key()}>{renderInline(text)}</p>
      ),
    );
  }
  return blocks;
}

const TABLE_ROW = /^\s*\|.*\|\s*$/;
const TABLE_RULE = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

/** The cells of a table row, without the outer pipes; "\|" stays a pipe inside a cell. */
function cellsOf(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split(/(?<!\\)\|/)
    .map((cell) => cell.trim().replace(/\\\|/g, "|"));
}

/** Our own address written out in full ("https://politicando.pt/parlamento") becomes the path, so it opens in place. */
const OWN_HOSTS = new Set(["politicando.pt", "www.politicando.pt", hostOf(SITE_URL)].filter(Boolean));

function hostOf(url: string): string | null {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

function ownPath(href: string): string | null {
  if (href.startsWith("/")) return isSitePath(href) ? href : null;
  try {
    const url = new URL(href);
    const path = `${url.pathname}${url.search}${url.hash}`;
    // "https://politicando.pt//evil.pt" keeps "//evil.pt" as its path: another site again.
    return /^https?:$/.test(url.protocol) && OWN_HOSTS.has(url.host) && isSitePath(path) ? path : null;
  } catch {
    return null;
  }
}

/** "quem-pode-ser-deputado" from "Quem pode ser deputado": an anchor for a section. */
export function headingId(text: string): string {
  return plainText(text)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** The post's top-level sections, for a table of contents: the headings that render as h2. */
export function sectionsOf(source: string): { id: string; title: string }[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const headings = lines.flatMap((line) => {
    const match = line.match(/^(#{1,6})\s+(.*)$/);
    return match ? [{ level: match[1]!.length, text: match[2]!.replace(/\s#+\s*$/, "") }] : [];
  });
  const biggest = Math.min(...headings.map((heading) => heading.level));
  return headings
    .filter((heading) => heading.level === biggest)
    .map((heading) => ({ id: headingId(heading.text), title: plainText(heading.text) }));
}

/** Inline marks, earliest first: escapes ("\\*" for a plain asterisk), code, images, links, bold, italic. */
const INLINE =
  /\\([\\`*_{}[\]()#+\-.!|>~])|`([^`]+)`|!\[([^\]]*)\]\(([^)\s]+)\)|\[([^\]]+)\]\(([^)\s]+)\)|\*\*(.+?)\*\*|__(.+?)__|\*(.+?)\*|(?<![\p{L}\d])_(.+?)_(?![\p{L}\d])/u;

export function renderInline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let rest = text;
  while (rest) {
    const match = rest.match(INLINE);
    if (!match || match.index === undefined) {
      out.push(rest);
      break;
    }
    if (match.index > 0) out.push(rest.slice(0, match.index));
    const [whole, escaped, code, alt, src, label, href, strong, strong2, em, em2] = match;
    const at = out.length;
    if (escaped !== undefined) out.push(escaped);
    else if (code !== undefined) out.push(<code key={at}>{code}</code>);
    else if (src !== undefined) {
      const safe = safeHttpUrl(src);
      // eslint-disable-next-line @next/next/no-img-element -- images from anywhere the editors link to
      out.push(safe ? <img key={at} src={safe} alt={alt ?? ""} loading="lazy" /> : (alt ?? ""));
    } else if (href !== undefined && ownPath(href)) {
      // A page of our own, as a path or our full address: same tab, through the router.
      out.push(
        <Link key={at} href={ownPath(href)!}>
          {renderInline(label!)}
        </Link>,
      );
    } else if (href !== undefined) {
      const safe = safeHttpUrl(href);
      out.push(
        safe ? (
          <a key={at} href={safe} target="_blank" rel="noopener noreferrer">
            {renderInline(label!)}
          </a>
        ) : (
          label!
        ),
      );
    } else if (strong !== undefined || strong2 !== undefined) out.push(<strong key={at}>{renderInline((strong ?? strong2)!)}</strong>);
    else if (em !== undefined || em2 !== undefined) out.push(<em key={at}>{renderInline((em ?? em2)!)}</em>);
    rest = rest.slice(match.index + whole.length);
  }
  return out;
}

/** The text without Markdown marks, for descriptions. */
export function plainText(source: string): string {
  return source
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^\s*\|?\s*:?-{2,}:?.*$/gm, " ")
    .replace(/^#{1,6}\s+|^>\s?|^\s*[-*+]\s+|^\s*\d+[.)]\s+/gm, "")
    .replace(/\|/g, " ")
    .replace(/\\([\\`*_{}[\]()#+\-.!|>~])/g, "\u0000$1")
    .replace(/(?<!\u0000)[*_`]/g, "")
    .replace(/\u0000/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
