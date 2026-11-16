import { z } from "zod";
import { tidyName } from "@/lib/elections";
import { cached, hourly, request, searchOf } from "./client";
import { safeHttpUrl } from "./mappers";

/** "How to become a deputy": the rules, how seats are shared out in a círculo, and the real lists. */

const sourceSchema = z.object({ label: z.string(), url: z.string().nullable() });

const explainerSchema = z.object({
  title: z.string(),
  reviewedAt: z.string().nullable(),
  sections: z.array(z.object({ id: z.string(), title: z.string(), body: z.array(z.string()), sources: z.array(sourceSchema) })),
  circles: z
    .object({
      election: z.string(),
      items: z.array(z.object({ key: z.string(), name: z.string(), seats: z.number() })),
    })
    .nullable(),
});

const placeSchema = z.object({ key: z.string(), name: z.string(), level: z.string(), dicofre: z.string().nullable() });

const dhondtSchema = z.object({
  election: z.object({ id: z.string(), name: z.string() }).loose(),
  place: placeSchema,
  seats: z.number(),
  lastSeat: z.object({ list: z.string(), quotient: z.number() }).nullable(),
  firstLoser: z.object({ list: z.string(), quotient: z.number() }).nullable(),
  lists: z.array(
    z.object({
      list: z.string(),
      name: z.string(),
      partySlugs: z.array(z.string()),
      votes: z.number(),
      seats: z.number(),
      quotients: z.array(z.number()),
      votesShortOfNextSeat: z.number().nullable(),
    }),
  ),
});

const candidateSchema = z.object({ position: z.number(), name: z.string(), elected: z.boolean(), deputyId: z.number().nullable() });

const candidatesSchema = z.object({
  election: z.object({ id: z.string(), name: z.string() }).loose(),
  place: placeSchema,
  circles: z.array(placeSchema),
  lists: z.array(
    z.object({
      list: z.string(),
      name: z.string(),
      partySlugs: z.array(z.string()),
      seats: z.number(),
      candidates: z.array(candidateSchema),
      alternates: z.array(candidateSchema),
    }),
  ),
});

const featuredSchema = z.object({
  items: z.array(
    z.object({
      kind: z.enum(["president", "government", "deputy"]),
      id: z.string(),
      name: z.string(),
      role: z.string(),
      photoUrl: z.string().nullable(),
      party: z.object({ slug: z.string(), acronym: z.string() }).nullable(),
    }),
  ),
});

export type ApiExplainerInput = z.input<typeof explainerSchema>;
export type ApiDhondtInput = z.input<typeof dhondtSchema>;
export type ApiCandidatesInput = z.input<typeof candidatesSchema>;
export type ApiFeaturedInput = z.input<typeof featuredSchema>;

export type ExplainerSource = { label: string; url: string | null };
export type ExplainerSection = { id: string; title: string; body: string[]; sources: ExplainerSource[] };
export type Explainer = {
  title: string;
  reviewedAt: string | null;
  sections: ExplainerSection[];
  circles: { election: string; items: { key: string; name: string; seats: number }[] } | null;
};
export type Dhondt = z.infer<typeof dhondtSchema>;
export type DhondtList = Dhondt["lists"][number];
export type Candidate = z.infer<typeof candidateSchema>;
export type CandidateList = z.infer<typeof candidatesSchema>["lists"][number];
export type Candidates = { place: { key: string; name: string }; circles: { key: string; name: string }[]; lists: CandidateList[] };
export type FeaturedPerson = z.infer<typeof featuredSchema>["items"][number];

export async function getBecomeDeputy(): Promise<Explainer> {
  const data = await request("/explainers/become-deputy", explainerSchema, hourly);
  return {
    ...data,
    sections: data.sections.map((section) => ({
      ...section,
      sources: section.sources.map((source) => ({ label: source.label, url: safeHttpUrl(source.url) })),
    })),
  };
}

/** The d'Hondt table for one círculo: each list's votes divided by 1, 2, 3… and the seats they won. */
export async function getDhondt(election: string, place: string): Promise<Dhondt> {
  const data = await request(`/elections/${encodeURIComponent(election)}/dhondt${searchOf({ place })}`, dhondtSchema, hourly);
  return { ...data, lists: data.lists.map((item) => ({ ...item, name: tidyName(item.name) })) };
}

/** The lists in one círculo, in order, with who got in. */
export async function getCandidates(election: string, place: string): Promise<Candidates> {
  const data = await request(`/elections/${encodeURIComponent(election)}/candidates${searchOf({ place })}`, candidatesSchema, hourly);
  return {
    place: { key: data.place.key, name: data.place.name },
    circles: data.circles.map(({ key, name }) => ({ key, name })).sort((a, b) => a.name.localeCompare(b.name, "pt")),
    lists: data.lists.map((item) => ({ ...item, name: tidyName(item.name) })),
  };
}

/** Who to show first: the President, the Prime Minister, the President of the Assembleia and party leaders. */
export async function getFeaturedPeople(): Promise<FeaturedPerson[]> {
  const data = await request("/people/featured", featuredSchema, cached);
  return data.items.map((item) => ({ ...item, photoUrl: safeHttpUrl(item.photoUrl) }));
}

/** Where a featured person's page is on our site, if we have one. */
export function featuredPath(person: Pick<FeaturedPerson, "kind" | "id">): string | null {
  if (person.kind === "deputy") return `/deputados/${person.id}`;
  if (person.kind === "government") return `/governo/${person.id}`;
  if (person.kind === "president") return "/presidente";
  return null;
}

/**
 * The cut-off line of a list: who is above it (elected on the night), and who entered later from below it by
 * replacing someone ("entrou por substituição"): below the line, yet with a deputy record.
 */
export function listStanding(list: CandidateList) {
  const above = list.candidates.slice(0, list.seats);
  const below = list.candidates.slice(list.seats);
  const replacements = [...below, ...list.alternates].filter((candidate) => candidate.deputyId !== null);
  return { above, below, replacements };
}

/**
 * The order in which the seats were won: each winning quotient ("list:divisor index") with its seat number. Ties go
 * to the list with fewer votes, as the electoral law says.
 */
export function seatOrder(lists: readonly DhondtList[]): Map<string, number> {
  const won = lists.flatMap((item) =>
    item.quotients.slice(0, item.seats).map((quotient, index) => ({ key: `${item.list}:${index}`, quotient, votes: item.votes })),
  );
  won.sort((a, b) => b.quotient - a.quotient || a.votes - b.votes);
  return new Map(won.map((item, index) => [item.key, index + 1]));
}
