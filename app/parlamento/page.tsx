import type { Metadata } from "next";
import { connection } from "next/server";
import { ParliamentView, type Selection } from "@/components/ParliamentView";
import { ApiError, getInitiatives, getParliament } from "@/lib/api/client";
import { formatDate } from "@/lib/format";
import type { InitiativePage, Parliament } from "@/lib/types";

export const metadata: Metadata = {
  title: "Parlamento",
  description: "Os 230 deputados da Assembleia da República, lugar a lugar, com as iniciativas aprovadas e em discussão.",
  alternates: { canonical: "/parlamento" },
};

type Props = { searchParams: Promise<{ deputado?: string | string[]; partido?: string | string[] }> };

/** Null while the API does not serve Parliament data yet, so the page can say so calmly. */
async function loadParliament(): Promise<Parliament | null> {
  try {
    return await getParliament();
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export default async function ParliamentPage({ searchParams }: Props) {
  await connection();
  const [parliament, initiatives, { deputado, partido }] = await Promise.all([
    loadParliament(),
    getInitiatives({ status: "approved" }).catch((): InitiativePage | null => null),
    searchParams,
  ]);
  // The view checks these against the real data and ignores anything unknown.
  const selection: Selection =
    typeof deputado === "string" && /^\d+$/.test(deputado)
      ? { party: "", deputy: Number(deputado) }
      : typeof partido === "string"
        ? { party: partido, deputy: null }
        : null;
  const updated = formatDate(parliament?.updatedAt);
  const header = (
    <header className="mb-3">
      <p className="mb-2 font-mono text-xs uppercase tracking-widest text-muted">
        Assembleia da República
        {parliament && ` · ${parliament.legislature} Legislatura`}
      </p>
      <h1 className="text-3xl font-bold leading-tight sm:text-4xl">Quem está sentado onde</h1>
    </header>
  );

  return (
    // data-wide lets this page use the full width instead of the news column.
    <div data-wide>
      {parliament ? (
        // The title sits in the map's column, so the card beside it can run from the title down.
        <ParliamentView parliament={parliament} initialInitiatives={initiatives} initialSelection={selection} header={header} />
      ) : (
        <>
          {header}
          <p className="rounded-2xl border border-dashed border-line p-8 text-center text-muted">
            Os dados do Parlamento estarão disponíveis em breve.
          </p>
        </>
      )}

      <p className="mt-12 border-t border-line pt-4 font-mono text-xs text-muted">
        Fonte: Assembleia da República (dados abertos)
        {parliament && `; lugares segundo a ${parliament.seatMap.source}`}
        {updated && ` · atualizado em ${updated}`}.
      </p>
    </div>
  );
}
