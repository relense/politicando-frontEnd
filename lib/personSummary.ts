import type { LocalOfficial } from "@/lib/api/localOfficials";
import type { PersonPath } from "@/lib/api/people";
import { formatLongDate } from "@/lib/format";
import { ageOn, isPartyLeaderPost } from "@/lib/parliament";
import type { DeputyDetail, DeputyVotesPage, GovernmentMemberDetail } from "@/lib/types";

/**
 * "Quem é": a few plain sentences about a person, written from their public records only (no guesses, no AI), for the
 * top of their page and for search results. Deputies' records don't say their gender, so their sentences avoid
 * gendered words; the Government's titles come gendered from the Government itself.
 */

/** "junho de 2025" from a date. */
const monthYear = (value: string | null | undefined) => formatLongDate(value)?.replace(/^\d+ de /, "") ?? null;

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** The posts that matter most right now, outside the chamber: the Government first, then leading a party. */
function headlinePosts(path: PersonPath | null, own: string[]) {
  // Current posts can sit in the current roles or, marked current, in the path itself.
  const now = [...(path?.currentRoles ?? []), ...(path?.path.filter((step) => step.current) ?? [])];
  const government = now.find((step) => step.kind === "government") ?? null;
  const leader = [...own, ...now.filter((step) => step.kind === "party").map((step) => step.title)].find(isPartyLeaderPost);
  return { government, leader: leader ?? null };
}

export type PersonSummary = {
  /** The page title: the name and what they are best known for now. */
  title: string;
  /** One sentence for search results. */
  description: string;
  /** The paragraph on the page. */
  sentences: string[];
};

export function deputySummary(
  deputy: DeputyDetail,
  path: PersonPath | null,
  votes: DeputyVotesPage["summary"] | null,
  now = new Date(),
): PersonSummary {
  const own = [...deputy.positions, ...deputy.roles.filter((role) => role.current).map((role) => role.title)];
  const { government, leader } = headlinePosts(path, own);
  const acronym = deputy.party?.acronym ?? null;
  const by = acronym ? `pelo ${acronym}` : "como independente";
  const suspended = !deputy.active && /suspen/i.test(deputy.situation ?? "");
  // With the gender on record, the usual words ("deputada do PS, eleita por Braga"); without it, a neutral phrasing.
  const female = deputy.gender === "F";
  const noun = female ? "deputada" : "deputado";
  const seat = deputy.active
    ? deputy.gender
      ? `é ${noun} ${acronym ? `do ${acronym}` : "independente"}, ${female ? "eleita" : "eleito"} pelo círculo de ${deputy.constituency}`
      : `representa o círculo de ${deputy.constituency} na Assembleia da República, ${by}`
    : suspended
      ? `tem suspenso o mandato parlamentar pelo círculo de ${deputy.constituency} (${acronym ?? "independente"})`
      : `não tem mandato ativo no Parlamento (círculo de ${deputy.constituency}, ${acronym ?? "independente"})`;
  const since = government ? monthYear(government.from) : null;
  // After the Government post, the seat continues the same sentence: "é Ministra … e deputada do PS", one «é».
  const lead = government
    ? `${deputy.name} é ${government.title}${since ? ` desde ${since}` : ""} e ${seat.replace(/^é /, "")}.`
    : `${deputy.name} ${seat}.`;

  const sentences = [lead];
  const age = ageOn(deputy.birthDate, now);
  const about = [deputy.profession, age !== null ? `${age} anos` : null].filter(Boolean).join(", ");
  if (about) sentences.push(`${about.charAt(0).toUpperCase()}${about.slice(1)}.`);
  if (leader) sentences.push(`${government ? "É também" : "É"} ${leader}.`);
  const past = deputy.pastLegislatures;
  sentences.push(
    past.length > 0
      ? `Antes desta, passou pelo Parlamento em ${plural(past.length, "legislatura", "legislaturas")} (${past.join(", ")}).`
      : "Está na primeira legislatura no Parlamento.",
  );
  const { total, approved } = deputy.initiatives;
  if (total > 0) sentences.push(`Nesta legislatura assina ${plural(total, "iniciativa", "iniciativas")}, ${approved} aprovadas.`);
  const counted = votes ? votes.favor + votes.against + votes.abstention : 0;
  if (votes && counted > 0) {
    sentences.push(
      votes.brokeRanks > 0
        ? `Em ${plural(counted, "votação registada", "votações registadas")}, votou ${plural(votes.brokeRanks, "vez", "vezes")} diferente da bancada.`
        : `Em ${plural(counted, "votação registada", "votações registadas")}, nunca votou diferente da bancada.`,
    );
  }

  const known = government?.title ?? leader ?? deputy.role ?? null;
  const party = acronym ? ` (${acronym})` : "";
  return {
    title: known
      ? `${deputy.name}${party}: ${known}`
      : deputy.gender
        ? `${deputy.name}${party}: ${female ? "Deputada" : "Deputado"} por ${deputy.constituency}`
        : `${deputy.name}${party}, ${deputy.constituency}: percurso, votações e iniciativas`,
    description: clipSentences(sentences),
    sentences,
  };
}

export function governmentMemberSummary(
  member: GovernmentMemberDetail,
  path: PersonPath | null,
  extra: { partyAcronym: string | null; governmentName: string | null },
): PersonSummary {
  const female = member.gender === "F";
  const current = member.positions.find((position) => !position.endDate) ?? null;
  const last = current ?? member.positions[0] ?? null;
  const sentences: string[] = [];
  if (current) {
    const since = monthYear(current.startDate);
    sentences.push(
      `${member.name} é ${current.title}${since ? ` desde ${since}` : ""}${extra.governmentName ? `, no ${extra.governmentName}` : ""}.`,
    );
  } else if (last) {
    const until = monthYear(last.endDate);
    sentences.push(`${member.name} foi ${last.title}${until ? ` até ${until}` : ""}.`);
  }
  // How the party is known: elected on its lists, or public membership. Without either, nothing is said.
  if (extra.partyAcronym && member.partySource === "deputy")
    sentences.push(
      `Foi ${female ? "eleita deputada" : "eleito deputado"} pelo ${extra.partyAcronym}${current ? " e deixou o lugar no Parlamento para entrar no Governo" : ""}.`,
    );
  else if (extra.partyAcronym) sentences.push(`É militante do ${extra.partyAcronym}.`);
  else if (member.independent) sentences.push("Não tem partido.");
  const others = member.positions.filter((position) => position !== last);
  if (others.length > 0) sentences.push(`Antes, ocupou ${plural(others.length, "outro cargo", "outros cargos")} no Governo.`);
  const { leader } = headlinePosts(path, []);
  if (leader) sentences.push(`${sentences.length > 0 ? "É também" : "É"} ${leader}.`);

  const party = extra.partyAcronym ? ` (${extra.partyAcronym})` : "";
  return {
    title: last ? `${member.name}${party}: ${current ? "" : "ex-"}${current ? last.title : lowerFirst(last.title)}` : member.name,
    description: clipSentences(sentences),
    sentences,
  };
}

const lowerFirst = (text: string) => `${text.charAt(0).toLowerCase()}${text.slice(1)}`;

/** As many whole sentences as fit a search result's snippet (about 155 characters), at least the first. */
function clipSentences(sentences: string[], max = 160): string {
  let text = sentences[0] ?? "";
  for (const sentence of sentences.slice(1)) {
    if (`${text} ${sentence}`.length > max) break;
    text = `${text} ${sentence}`;
  }
  return text;
}

/** A presidente da câmara: whose câmara, since when, for which list, until when. Gender isn't known, so no gendered words. */
export function localOfficialSummary(official: LocalOfficial, partyAcronyms: string[]): PersonSummary {
  const since = monthYear(official.term.start);
  const list = official.label ? `, pela lista ${official.label}${partyAcronyms.length > 0 ? ` (${partyAcronyms.join(", ")})` : ""}` : "";
  const sentences = [
    official.current
      ? `${official.shortName} preside à Câmara Municipal de ${official.place.name}${since ? ` desde ${since}` : ""}${list}.`
      : `${official.shortName} presidiu à Câmara Municipal de ${official.place.name}${list}.`,
  ];
  const end = official.term.end?.slice(0, 4);
  if (official.current && end) sentences.push(`O mandato vai até às autárquicas de ${end}.`);
  if (official.name !== official.shortName) sentences.push(`No boletim de voto: ${official.name}.`);
  if (official.otherRoles.some((role) => role.kind === "deputy")) sentences.push("Passou também pelo Parlamento.");
  const candidacies = official.otherRoles.filter((role) => role.kind === "candidate").length;
  if (candidacies > 0)
    sentences.push(`Tem ${plural(candidacies, "outra candidatura", "outras candidaturas")} registada${candidacies === 1 ? "" : "s"}.`);
  return {
    title: `${official.shortName}, presidente da Câmara Municipal de ${official.place.name}`,
    description: clipSentences(sentences),
    sentences,
  };
}
