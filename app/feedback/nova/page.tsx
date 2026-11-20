import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { CorrectionList } from "@/components/CorrectionList";
import { FeedbackForm } from "@/components/FeedbackForm";
import { NewIdeaForm } from "@/components/ideas/NewIdeaForm";
import { getFeedbackSummary } from "@/lib/api/feedback";
import { SITE_AREAS } from "@/lib/feedbackAreas";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const TABS = [
  {
    key: "ideia",
    label: "Ideia",
    note: "pública · pede conta",
    crumb: "Nova ideia",
    title: "Propor uma ideia",
    intro: "Já procuraste no quadro e não encontraste? Escreve-a aqui. Fica pública para outros votarem.",
  },
  {
    key: "erro",
    label: "Erro nos dados",
    note: "privado · sem conta",
    crumb: "Reportar um erro",
    title: "Reportar um erro",
    intro: "Um número, uma data ou um nome errado. Vai em privado para a redação, e podes enviar sem conta.",
  },
  {
    key: "falha",
    label: "Algo não funciona",
    note: "privado · sem conta",
    crumb: "Algo não funciona",
    title: "Algo não funciona",
    intro: "Uma página que não abre ou um botão parado. Vai em privado para a equipa, e podes enviar sem conta.",
  },
] as const;
type Tab = (typeof TABS)[number];

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const tabOf = (value: unknown): Tab => TABS.find((tab) => tab.key === value) ?? TABS[0];

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const tab = tabOf(first((await searchParams).tipo));
  return {
    title: `${tab.title} · Feedback`,
    description: tab.intro,
    alternates: { canonical: tab.key === "ideia" ? "/feedback/nova" : `/feedback/nova?tipo=${tab.key}` },
  };
}

const IDEA_NEXT = [
  { title: "Fica no quadro", text: "Outros votam e comentam." },
  { title: "Lemos na mesma semana", text: "Damos um estado e uma frase a explicar." },
  { title: "Avisamos-te", text: "Recebes uma notificação a cada mudança." },
];
const ERROR_NEXT = [
  { title: "Lemos", text: "Uma pessoa da redação lê cada mensagem." },
  { title: "Confirmamos na fonte", text: "Erros só são corrigidos depois de confirmados numa fonte oficial." },
  { title: "Corrigimos em público", text: "A correção fica no registo, com data, e na própria página." },
];

const heading = "font-mono text-[11px] font-bold uppercase tracking-widest";

function Steps({ items }: { items: { title: string; text: string }[] }) {
  return (
    <ol className="mt-3 space-y-3">
      {items.map((item, index) => (
        <li key={item.title} className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-2">
          <span
            aria-hidden="true"
            className="flex size-6 items-center justify-center rounded-full bg-surface font-mono text-[11px] font-bold"
          >
            {index + 1}
          </span>
          <span>
            <b className="block text-sm">{item.title}</b>
            <span className="block text-xs leading-snug text-muted">{item.text}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

/** A new idea (public, on the board) or a private message: an error in the data, or something that doesn't work. */
export default async function NewFeedbackPage({ searchParams }: Props) {
  await connection();
  const params = await searchParams;
  const tab = tabOf(first(params.tipo));
  const idea = tab.key === "ideia";
  const summary = idea ? null : await getFeedbackSummary().catch(() => null);
  const page = SITE_AREAS.find((name) => name === first(params.pagina)) ?? null;
  const link = first(params.ligacao);

  return (
    <div data-wide className="grid grid-cols-[minmax(0,1fr)] gap-8 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 max-w-2xl">
        <nav aria-label="Caminho" className="mb-4 font-mono text-xs">
          <Link href="/feedback" className="text-link underline">
            Feedback
          </Link>
          <span aria-hidden="true" className="text-muted">
            {" "}
            ›{" "}
          </span>
          <span aria-current="page" className="text-muted">
            {tab.crumb}
          </span>
        </nav>
        <h1 className="text-3xl font-bold leading-tight sm:text-4xl">{tab.title}</h1>
        <p className="mt-2 leading-relaxed text-muted">{tab.intro}</p>

        <nav aria-label="O que queres enviar?" className="my-6">
          <ul className="grid grid-cols-3 gap-1 rounded-xl border border-line p-1">
            {TABS.map((item) => (
              <li key={item.key} className="min-w-0">
                <Link
                  href={item.key === "ideia" ? "/feedback/nova" : `/feedback/nova?tipo=${item.key}`}
                  aria-current={item.key === tab.key ? "page" : undefined}
                  className={`flex h-full flex-col items-center justify-center rounded-lg px-1 py-1.5 text-center ${
                    item.key === tab.key ? "bg-ink text-paper" : "text-muted hover:bg-surface hover:text-ink"
                  }`}
                >
                  <span className="font-mono text-[11px] font-bold leading-tight sm:text-xs">{item.label}</span>
                  <span className="mt-0.5 font-mono text-[10px] leading-tight">{item.note}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {idea ? (
          <NewIdeaForm key="ideia" areas={SITE_AREAS} initialTitle={first(params.titulo)?.slice(0, 150) ?? ""} />
        ) : (
          <FeedbackForm
            key={tab.key}
            kind={tab.key === "erro" ? "error" : "broken"}
            pages={[...SITE_AREAS]}
            initialPage={page}
            initialUrl={link?.startsWith("http") || link?.startsWith("/") ? link : null}
          />
        )}
      </div>

      <aside aria-label="Depois de enviares" className="flex flex-col gap-4 xl:sticky xl:top-20 xl:self-start">
        <section aria-labelledby="a-seguir" className="rounded-2xl border border-line p-4">
          <h2 id="a-seguir" className={`${heading} text-muted`}>
            O que acontece a seguir
          </h2>
          <Steps items={idea ? IDEA_NEXT : ERROR_NEXT} />
          {summary && (
            <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-3">
              {summary.responseDays !== null && (
                <div className="flex flex-col-reverse">
                  <dt className="font-mono text-[11px] text-muted">tempo médio de resposta</dt>
                  <dd className="text-2xl font-bold">
                    {Math.round(summary.responseDays)} {Math.round(summary.responseDays) === 1 ? "dia" : "dias"}
                  </dd>
                </div>
              )}
              <div className="flex flex-col-reverse">
                <dt className="font-mono text-[11px] text-muted">correções este mês</dt>
                <dd className="text-2xl font-bold text-[var(--stage-approved)]">{summary.correctionsThisMonth}</dd>
              </div>
            </dl>
          )}
        </section>

        {idea ? (
          <section aria-labelledby="e-um-erro" className="rounded-2xl border border-line p-4">
            <h2 id="e-um-erro" className="font-bold">
              É um erro e não uma ideia?
            </h2>
            <p className="mt-1 text-sm text-muted">Erros vão em privado para a redação, sem conta.</p>
            <Link
              href="/feedback/nova?tipo=erro"
              className="mt-3 inline-flex min-h-9 items-center rounded-full border border-line px-4 font-mono text-xs font-bold hover:bg-surface"
            >
              Reportar um erro
            </Link>
          </section>
        ) : (
          <>
            {summary && summary.corrections.length > 0 && (
              <section aria-labelledby="registo-correcoes" className="rounded-2xl border border-line p-4">
                <div className="mb-1 flex items-baseline justify-between gap-2">
                  <h2 id="registo-correcoes" className={heading}>
                    Registo de correções
                  </h2>
                  <Link href="/feedback/correcoes" className="font-mono text-[11px] underline hover:text-ink">
                    Ver tudo
                  </Link>
                </div>
                <CorrectionList items={summary.corrections.slice(0, 4)} compact />
              </section>
            )}
            <section aria-labelledby="e-uma-ideia" className="rounded-2xl border border-line p-4">
              <h2 id="e-uma-ideia" className="font-bold">
                É uma ideia, e não um erro?
              </h2>
              <p className="mt-1 text-sm text-muted">
                As ideias ficam no quadro, onde outros votam nelas. Procura primeiro: pode já existir.
              </p>
              <Link
                href="/feedback"
                className="mt-3 inline-flex min-h-9 items-center rounded-full border border-line px-4 font-mono text-xs font-bold hover:bg-surface"
              >
                Ir ao quadro de ideias
              </Link>
            </section>
          </>
        )}
      </aside>
    </div>
  );
}
