"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { getReports, REPORT_REASON_LABELS, resolveReport, type Report } from "@/lib/api/admin";
import { formatDateTime } from "@/lib/format";
import { buttonClass, Empty, ErrorNote, Tabs, useExpiry } from "./ui";

const KIND_LABELS: Record<Report["kind"], string> = {
  thread: "Discussão",
  post: "Resposta no fórum",
  comment: "Comentário",
  article: "Notícia",
};

/** Where the reported thing lives on the site. */
function hrefOf(report: Report): string | null {
  const target = report.target;
  if (!target) return null;
  if (report.kind === "article") return `/article/${report.targetId}`;
  if (report.kind === "comment" && target.articleId) return `/article/${target.articleId}#comentarios`;
  // The thread page moves to the right board on its own.
  if (target.threadId) return `/forum/geral/${target.threadId}${report.kind === "post" ? `#post-${report.targetId}` : ""}`;
  return null;
}

/** Reported comments and forum posts, most reported first: hide them or dismiss the reports. */
export function ReportsQueue() {
  const [status, setStatus] = useState<"open" | "resolved">("open");
  const client = useQueryClient();
  const expiry = useExpiry();
  const reports = useQuery({ queryKey: ["admin-reports", status], queryFn: () => getReports(status) });
  const resolve = useMutation({
    mutationFn: ({ report, action }: { report: Report; action: "hide" | "dismiss" }) => resolveReport(report.kind, report.targetId, action),
    onSuccess: () => client.invalidateQueries({ queryKey: ["admin-reports"] }),
    onError: expiry,
  });
  if (reports.isError) expiry(reports.error);

  return (
    <section aria-labelledby="denuncias">
      <h1 id="denuncias" className="mb-1 text-2xl font-bold">
        Denúncias
      </h1>
      <p className="mb-4 text-sm text-muted">
        O que os leitores denunciaram, o mais denunciado primeiro. Esconder tira-o do site e fecha as denúncias; ignorar só as fecha.
      </p>
      <Tabs
        label="Estado das denúncias"
        value={status}
        onChange={setStatus}
        options={[
          { value: "open", label: "Por decidir" },
          { value: "resolved", label: "Resolvidas" },
        ]}
      />
      <ErrorNote error={resolve.error ?? reports.error} />
      {reports.isPending ? (
        <p className="text-muted">A carregar…</p>
      ) : reports.data && reports.data.length === 0 ? (
        <Empty>{status === "open" ? "Nada por decidir. Bom trabalho." : "Ainda não há denúncias resolvidas."}</Empty>
      ) : (
        <ul aria-label="Denúncias" className="flex flex-col gap-3">
          {reports.data?.map((report) => {
            const href = hrefOf(report);
            const busy = resolve.isPending && resolve.variables?.report === report;
            return (
              <li key={`${report.kind}-${report.targetId}`}>
                <article className="rounded-2xl border border-line p-4">
                  <p className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs text-muted">
                    <span className="font-bold text-ink">{KIND_LABELS[report.kind]}</span>
                    <span>#{report.targetId}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-bold text-danger">{report.reports === 1 ? "1 denúncia" : `${report.reports} denúncias`}</span>
                    <span aria-hidden="true">·</span>
                    <span>desde {formatDateTime(report.firstReportedAt)}</span>
                    {report.target?.hidden && <span className="rounded-full border border-line px-2 py-0.5 text-ink">Escondido</span>}
                    {report.resolution && (
                      <span className="rounded-full border border-line px-2 py-0.5 text-ink">
                        {report.resolution === "hide" ? "Escondido" : "Ignorado"}
                      </span>
                    )}
                  </p>
                  <p className="mb-2 flex flex-wrap gap-1.5">
                    {report.reasons.map((reason) => (
                      <span key={reason} className="rounded-full bg-surface px-2 py-0.5 font-mono text-[11px] font-bold">
                        {REPORT_REASON_LABELS[reason] ?? reason}
                      </span>
                    ))}
                  </p>
                  {report.target?.text ? (
                    <blockquote className="whitespace-pre-line break-words border-l-2 border-line pl-3 leading-relaxed">
                      {report.target.text}
                    </blockquote>
                  ) : (
                    <p className="text-sm text-muted">Já não existe.</p>
                  )}
                  {report.details.length > 0 && (
                    <ul className="mt-2 space-y-1 text-sm text-muted">
                      {report.details.map((detail, index) => (
                        <li key={index}>«{detail}»</li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {status === "open" && (
                      <>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => resolve.mutate({ report, action: "hide" })}
                          className={buttonClass("danger")}
                        >
                          Esconder
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => resolve.mutate({ report, action: "dismiss" })}
                          className={buttonClass()}
                        >
                          Ignorar denúncias
                        </button>
                      </>
                    )}
                    {href && (
                      <Link href={href} target="_blank" className="font-mono text-xs text-link underline">
                        Ver no site ↗
                      </Link>
                    )}
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
