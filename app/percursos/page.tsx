import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { GovernmentPortrait } from "@/components/GovernmentPortrait";
import { PathsExplorer, TONE_COLOR, type PathCell, type PathRow, type PathTone } from "@/components/PathsExplorer";
import { getElections, getParliament } from "@/lib/api/client";
import { type FeaturedPerson, getFeaturedPeople, type PathStep, type PersonPath, personHref, tryPersonPath } from "@/lib/api/people";
import { formatDate } from "@/lib/format";
import { durationLabel } from "@/lib/history";
import { partyColor } from "@/lib/parliament";

export const metadata: Metadata = {
  title: "Percursos: como chegaram lá",
  description:
    "O percurso do Presidente da República, do Primeiro-Ministro, do Presidente da Assembleia e dos líderes partidários: cargos no Parlamento, no Governo e na Presidência, com fontes oficiais.",
  alternates: { canonical: "/percursos" },
};

const MARKER = "bg-[linear-gradient(transparent_55%,var(--marker)_55%,var(--marker)_92%,transparent_92%)] px-1";
const TOP_KICKERS = ["Chefe de Estado", "Chefe do Governo", "Presidente do Parlamento"];
const ROMAN = [
  "",
  "I",
  "II",
  "III",
  "IV",
  "V",
  "VI",
  "VII",
  "VIII",
  "IX",
  "X",
  "XI",
  "XII",
  "XIII",
  "XIV",
  "XV",
  "XVI",
  "XVII",
  "XVIII",
  "XIX",
  "XX",
];

async function loadFeatured(): Promise<FeaturedPerson[]> {
  try {
    return await getFeaturedPeople();
  } catch {
    return [];
  }
}

type Column = { title: string; note: string };

const SPEAKER = /^Presidente da Assembleia da República/;
const end = (step: PathStep, today: string) => step.to ?? today;

/** What colour a step is: Parliament, the Speaker's chair, the Government or the Presidency. */
function toneOf(step: PathStep, speaker: boolean): PathTone {
  if (step.kind === "government") return "government";
  if (step.kind === "presidency") return "president";
  if (step.kind === "election") return "election";
  return speaker ? "speaker" : "parliament";
}

/** "Deputado · Lisboa", "Primeiro-Ministro": a step in a few words. */
function shortTitle(step: PathStep, speaker: boolean): string {
  if (step.kind !== "parliament") return step.title;
  const title = step.title.replace(/ à Assembleia da República$/, "");
  if (speaker) return `${title} · PAR`;
  const circle = step.detail?.match(/eleit[oa] por (.+)$/)?.[1];
  return circle ? `${title} · ${circle}` : title;
}

/** "nº 1 · Lisboa" from "nº 1 da lista CH, círculo de Lisboa (eleito)". */
function electionLabel(step: PathStep): string {
  const match = step.detail?.match(/nº (\d+).*círculo de ([^(]+)/);
  return match ? `nº ${match[1]} · ${match[2]!.trim()}` : (step.detail ?? step.title);
}

const PRIORITY: Record<string, number> = { presidency: 4, government: 3, parliament: 2 };

/** The main thing someone did in a stretch of time: the highest office, the latest if several. */
function cellFor(path: PersonPath | null, from: string, to: string, today: string, speaker: boolean): PathCell {
  const steps = (path?.path ?? []).filter((step) => step.kind !== "election" && step.from && step.from < to && end(step, today) > from);
  const best = steps.sort((a, b) => (PRIORITY[b.kind] ?? 0) - (PRIORITY[a.kind] ?? 0) || (b.from ?? "").localeCompare(a.from ?? ""))[0];
  return best
    ? { label: shortTitle(best, speaker && best.kind === "parliament"), tone: toneOf(best, speaker && best.kind === "parliament") }
    : null;
}

const years = (from: string, to: string) => (Date.parse(to) - Date.parse(from)) / (365.25 * 86_400_000);

/** Up to three figures for the panel: governments, time in the office held now, years as a deputy. */
function statsOf(path: PersonPath | null, today: string): PathRow["stats"] {
  if (!path) return [];
  const stats: PathRow["stats"] = [];
  const governments = path.path.filter((step) => step.kind === "government").length;
  if (governments > 0) stats.push({ value: String(governments), label: governments === 1 ? "governo" : "governos" });
  const now = path.path.find((step) => step.current && step.from && step.kind !== "election");
  if (now?.from)
    stats.push({
      value: durationLabel(now.from, today)
        .replace(/ anos?/, " a")
        .replace(/ e /, " ")
        .replace(/ m[eê]s(es)?/, " m"),
      label: "no cargo atual",
    });
  const deputy = path.path
    .filter((step) => step.kind === "parliament" && step.from)
    .reduce((sum, step) => sum + years(step.from!, end(step, today)), 0);
  if (deputy >= 1) stats.push({ value: String(Math.round(deputy)), label: "anos deputado" });
  return stats.slice(0, 3);
}

export default async function PathsPage() {
  await connection();
  const today = new Date().toISOString().slice(0, 10);
  const [people, legislativas, parliament] = await Promise.all([
    loadFeatured(),
    getElections("legislativas").catch(() => []),
    getParliament().catch(() => null),
  ]);
  const paths = await Promise.all(people.map((person) => tryPersonPath(person.kind, person.id)));

  const last = legislativas[0]?.date ?? today;
  const before = legislativas[1]?.date ?? last;
  const legislature = parliament?.legislature ?? "";
  const previous = ROMAN[ROMAN.indexOf(legislature) - 1] ?? "";
  const columns: [Column, Column, Column] = [
    { title: previous ? `${previous} Legislatura` : "Legislatura anterior", note: `${before.slice(0, 4)}–${last.slice(0, 4)}` },
    { title: legislativas[0]?.name ?? "Últimas legislativas", note: formatDate(last) ?? "" },
    { title: legislature ? `${legislature} Legislatura` : "Legislatura atual", note: `desde ${last.slice(0, 4)}` },
  ];

  const rows: PathRow[] = people.map((person, index) => {
    const path = paths[index] ?? null;
    const speaker = Boolean(path?.currentRoles.some((role) => SPEAKER.test(role.title))) || SPEAKER.test(person.role ?? "");
    const election = path?.path.find((step) => step.kind === "election" && step.from === last) ?? null;
    const current = cellFor(path, today, "9999-12-31", today, speaker) ?? cellFor(path, last, "9999-12-31", today, speaker);
    const top = index < 3;
    return {
      key: `${person.kind}-${person.id}`,
      name: person.name,
      role: person.role,
      photoUrl: person.photoUrl,
      party: person.party ? { ...person.party, color: partyColor(person.party.slug) } : null,
      group: top ? "top" : "leader",
      href: person.kind === "president" ? personHref(person.kind, person.id) : `${personHref(person.kind, person.id)}#percurso`,
      cells: [
        cellFor(path, before, last, today, false),
        election ? { label: electionLabel(election), tone: "election" } : null,
        cellFor(path, last, "9999-12-31", today, speaker),
      ],
      today: top && person.role ? { label: person.role, tone: current?.tone ?? "parliament" } : current,
      stats: statsOf(path, today),
      steps: path?.path ?? [],
    };
  });

  // Where the party leaders headed their lists: often all in the same, biggest circle.
  const leaders = rows.filter((row) => row.group === "leader");
  const headed = leaders.flatMap((row) => (row.cells[1]?.label.startsWith("nº 1 · ") ? [row.cells[1].label.slice(7)] : []));
  const circles = new Map<string, number>();
  for (const circle of headed) circles.set(circle, (circles.get(circle) ?? 0) + 1);
  const [circle, count] = [...circles].sort((a, b) => b[1] - a[1])[0] ?? [null, 0];

  return (
    <div data-wide>
      <header className="mb-8 flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-3xl">
          <p className="mb-2 font-mono text-xs uppercase tracking-widest text-muted">Saber mais · Percursos</p>
          <h1 className="text-4xl font-bold leading-tight sm:text-5xl">
            Como <span className={MARKER}>chegaram</span> lá
          </h1>
          <p className="mt-3 text-lg leading-relaxed text-muted">
            Quem ocupa os cargos de topo e o caminho que fez até lá: mandatos no Parlamento, cargos no Governo e na Presidência, e as listas
            por que foram eleitos. Tudo vem de fontes oficiais.
          </p>
        </div>
      </header>

      {people.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line p-8 text-center text-muted">Os percursos ainda não estão disponíveis.</p>
      ) : (
        <>
          <section aria-labelledby="topo">
            <h2 id="topo" className="mb-4 border-b-2 border-ink pb-2 font-mono text-sm font-bold uppercase tracking-widest">
              Os três cargos de topo do Estado
            </h2>
            <ul className="grid gap-4 lg:grid-cols-3">
              {rows.slice(0, 3).map((row, index) => (
                <TopCard
                  key={row.key}
                  row={row}
                  kicker={`${index + 1} · ${TOP_KICKERS[index] ?? ""}`}
                  path={paths[index] ?? null}
                  today={today}
                />
              ))}
            </ul>
          </section>

          <PathsExplorer rows={rows} columns={columns} />

          {circle && count >= 2 && (
            <p className="mt-6 flex flex-wrap items-center gap-4 rounded-2xl border border-line p-4 xl:mr-[22.25rem]">
              <span className="text-4xl font-bold text-[var(--stage-debate)]">
                {count} de {leaders.length}
              </span>
              <span className="min-w-0 flex-1 leading-snug">
                líderes partidários desta lista foram nº 1 pelo círculo de {circle} em {last.slice(0, 4)}.
                {circle === "Lisboa" && " É o círculo que elege mais deputados, por isso os partidos põem lá quem querem garantir."}
              </span>
            </p>
          )}
        </>
      )}

      <p className="mt-10 border-t border-line pt-4 font-mono text-xs text-muted">
        Fontes: Assembleia da República, portal do Governo, Presidência da República e CNE. As legislaturas mostram os anos da legislatura,
        não as datas exatas de cada mandato.
      </p>
    </div>
  );
}

/** One of the three top offices: who holds it, since when, and the steps that led there. */
function TopCard({ row, kicker, path, today }: { row: PathRow; kicker: string; path: PersonPath | null; today: string }) {
  const color = row.party?.color ?? "var(--stage-president)";
  const now = path?.path.find((step) => step.current && step.from && step.kind !== "election");
  const recent = [...(path?.path ?? [])]
    .filter((step) => step.from)
    .sort((a, b) => (a.from ?? "").localeCompare(b.from ?? ""))
    .slice(-3);
  return (
    <li className="flex flex-col rounded-2xl border border-t-4 border-line p-4" style={{ borderTopColor: color }}>
      <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-muted">{kicker}</p>
      <div className="mt-3 flex items-center gap-3">
        <span className="shrink-0 rounded-full p-0.5" style={{ boxShadow: `0 0 0 2px ${color}` }}>
          <GovernmentPortrait name={row.name} photoUrl={row.photoUrl} size="md" />
        </span>
        <div className="min-w-0">
          <h3 className="text-xl font-bold leading-tight">
            <Link href={row.href} className="hover:underline">
              {row.name}
            </Link>
          </h3>
          {row.role && <p className="text-sm leading-snug text-muted">{row.role}</p>}
        </div>
      </div>
      <p className="mt-3 flex flex-wrap gap-1.5 font-mono text-[10px] font-bold">
        <span className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5" style={{ borderColor: color }}>
          <span aria-hidden="true" className="size-1.5 rounded-full" style={{ backgroundColor: color }} />
          {row.party?.acronym ?? "Sem filiação no cargo"}
        </span>
        {now?.from && <span className="rounded-md bg-surface px-1.5 py-0.5">há {durationLabel(now.from, today)}</span>}
      </p>
      {recent.length > 1 && (
        <ol aria-label="Últimos passos" className="mt-4 flex items-center gap-2 border-t border-line pt-3 font-mono text-[10px] text-muted">
          {recent.map((step, index) => (
            <li key={`${step.title}-${step.from}`} className="flex min-w-0 flex-1 items-center gap-1.5 last:flex-none">
              <span
                aria-hidden="true"
                className={`size-2.5 shrink-0 ${step.kind === "election" ? "rotate-45 border border-muted" : "rounded-full border-2"}`}
                style={
                  step.kind === "election"
                    ? undefined
                    : step.current
                      ? { backgroundColor: TONE_COLOR[toneOf(step, false)], borderColor: TONE_COLOR[toneOf(step, false)] }
                      : { borderColor: TONE_COLOR[toneOf(step, false)] }
                }
              />
              <span className="whitespace-nowrap" title={`${step.title}${step.detail ? `, ${step.detail}` : ""}`}>
                {step.kind === "election"
                  ? step.from!.slice(0, 4)
                  : (step.detail?.match(/^(\w+) legislatura/)?.[1] ?? step.from!.slice(0, 4))}
              </span>
              {index < recent.length - 1 && <span aria-hidden="true" className="h-px flex-1 bg-line" />}
            </li>
          ))}
        </ol>
      )}
    </li>
  );
}
