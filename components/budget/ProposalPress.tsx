import Link from "next/link";
import type { BudgetNews, BudgetStatement } from "@/lib/api/budget";
import { partyFull, statementGroups } from "@/lib/budget";
import { formatDate } from "@/lib/format";
import { partyColor } from "@/lib/parliament";

const heading = "border-b-2 border-ink pb-1 font-mono text-xs font-bold uppercase tracking-widest";

/** «O que disseram»: what the parties said about the proposal, from the news (not the parliament). Hidden when empty. */
export function ProposalStatements({ statements }: { statements: BudgetStatement[] }) {
  const groups = statementGroups(statements);
  if (groups.length === 0) return null;
  return (
    <section aria-labelledby="disseram" className="mt-6">
      <h2 id="disseram" className={heading}>
        O que disseram
      </h2>
      <p className="mt-2 font-mono text-[11px] text-muted">Declarações recolhidas das notícias, não do Parlamento.</p>
      <div className="mt-3 flex flex-col gap-5">
        {groups.map(({ party, statements: said }) => (
          <div key={party.slug}>
            <h3 className="flex items-center gap-2 text-sm font-bold">
              <span aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: partyColor(party.slug) }} />
              {partyFull(party)}
            </h3>
            <ul className="mt-2 flex flex-col gap-3 border-l-2 border-line pl-3">
              {said.map((statement, index) => (
                <li key={`${statement.articleId}-${index}`}>
                  <blockquote className="text-sm leading-snug [overflow-wrap:anywhere]">«{statement.text}»</blockquote>
                  <p className="mt-1 font-mono text-[11px] text-muted">
                    {statement.deputy && <>{statement.deputy}, </>}
                    <Link href={`/article/${statement.articleId}`} className="underline underline-offset-2 hover:text-ink">
                      segundo {statement.source || "a notícia"}
                    </Link>
                    {statement.publishedAt && <> · {formatDate(statement.publishedAt)}</>}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

/** «Nas notícias»: the news about the proposal, newest first, each to its page here. Hidden when empty. */
export function ProposalNewsList({ news }: { news: BudgetNews[] }) {
  if (news.length === 0) return null;
  return (
    <section aria-labelledby="nas-noticias" className="mt-6">
      <h2 id="nas-noticias" className={heading}>
        Nas notícias
      </h2>
      <ul className="mt-3 flex flex-col gap-3">
        {news.map((item) => (
          <li key={item.id}>
            <Link href={`/article/${item.id}`} className="text-sm font-semibold leading-snug hover:underline [overflow-wrap:anywhere]">
              {item.title}
            </Link>
            <p className="mt-0.5 font-mono text-[11px] text-muted">
              {[item.source, item.publishedAt && formatDate(item.publishedAt)].filter(Boolean).join(" · ")}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
