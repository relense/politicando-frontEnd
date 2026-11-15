import { z } from "zod";
import { cached, request } from "./client";
import { safeHttpUrl } from "./mappers";

/** Career paths: one timeline per person, joining their records in Parliament, the Government and the Presidency. */

export type PersonKind = "deputy" | "government" | "president";
export type StepKind = "parliament" | "government" | "presidency" | "party" | "local" | "election" | "other";

export type PathStep = {
  from: string | null;
  to: string | null;
  /** "legislature": they sat at some point in that legislature; the dates are the legislature's, not theirs. */
  precision: "day" | "legislature";
  title: string;
  detail: string | null;
  kind: StepKind;
  current: boolean;
  source: string | null;
};

export type RecordStatus = { key: string; label: string };

export type PersonRecords = {
  cases: { id: number; title: string; status: RecordStatus; personStatus: RecordStatus; final: boolean }[];
  interests: number;
};

export type PersonPath = {
  person: {
    name: string;
    photoUrl: string | null;
    party: { slug: string; acronym: string } | null;
    links: { deputyId: number | null; governmentMemberId: string | null; presidentId: string | null };
  };
  path: PathStep[];
  currentRoles: PathStep[];
  otherRoles: PathStep[];
  records: PersonRecords;
};

export type FeaturedPerson = {
  kind: PersonKind;
  id: string;
  name: string;
  role: string | null;
  photoUrl: string | null;
  party: { slug: string; acronym: string } | null;
};

const STEP_KINDS: readonly StepKind[] = ["parliament", "government", "presidency", "party", "local", "election", "other"];

const partySchema = z.object({ slug: z.string(), acronym: z.string() }).nullish();
const statusSchema = z.object({ key: z.string(), label: z.string() });

const stepSchema = z.object({
  from: z.string().nullish(),
  to: z.string().nullish(),
  precision: z.string().nullish(),
  title: z.string(),
  detail: z.string().nullish(),
  kind: z.string().nullish(),
  current: z.boolean().nullish(),
  source: z.string().nullish(),
});

export const personPathSchema = z.object({
  person: z.object({
    name: z.string(),
    photoUrl: z.string().nullish(),
    party: partySchema,
    links: z
      .object({
        deputyId: z.number().nullish(),
        governmentMemberId: z.string().nullish(),
        presidentId: z.string().nullish(),
      })
      .nullish(),
  }),
  path: z.array(stepSchema).default([]),
  currentRoles: z.array(stepSchema).default([]),
  otherRoles: z.array(stepSchema).default([]),
  records: z
    .object({
      cases: z
        .array(
          z.object({ id: z.number(), title: z.string(), status: statusSchema, personStatus: statusSchema, final: z.boolean().nullish() }),
        )
        .default([]),
      interests: z.number().default(0),
    })
    .nullish(),
});

export const featuredSchema = z.object({
  items: z.array(
    z.object({
      kind: z.string(),
      id: z.union([z.string(), z.number()]),
      name: z.string(),
      role: z.string().nullish(),
      photoUrl: z.string().nullish(),
      party: partySchema,
    }),
  ),
});

export type ApiPersonPath = z.input<typeof personPathSchema>;
export type ApiFeatured = z.input<typeof featuredSchema>;

function mapStep(step: z.infer<typeof stepSchema>): PathStep {
  return {
    from: step.from ?? null,
    to: step.to ?? null,
    precision: step.precision === "legislature" ? "legislature" : "day",
    title: step.title,
    detail: step.detail ?? null,
    kind: STEP_KINDS.includes(step.kind as StepKind) ? (step.kind as StepKind) : "other",
    current: step.current ?? false,
    // Some sources are the API's own paths ("/elections/…"); only full web addresses become links.
    source: safeHttpUrl(step.source),
  };
}

export function mapPersonPath(raw: z.infer<typeof personPathSchema>): PersonPath {
  const links = raw.person.links;
  return {
    person: {
      name: raw.person.name,
      photoUrl: safeHttpUrl(raw.person.photoUrl),
      party: raw.person.party ?? null,
      links: {
        deputyId: links?.deputyId ?? null,
        governmentMemberId: links?.governmentMemberId ?? null,
        presidentId: links?.presidentId ?? null,
      },
    },
    path: raw.path.map(mapStep),
    currentRoles: raw.currentRoles.map(mapStep),
    otherRoles: raw.otherRoles.map(mapStep),
    records: {
      cases: (raw.records?.cases ?? []).map((item) => ({ ...item, final: item.final ?? false })),
      interests: raw.records?.interests ?? 0,
    },
  };
}

const PERSON_KINDS: readonly PersonKind[] = ["deputy", "government", "president"];

export function mapFeatured(raw: z.infer<typeof featuredSchema>): FeaturedPerson[] {
  return raw.items
    .filter((item) => PERSON_KINDS.includes(item.kind as PersonKind))
    .map((item) => ({
      kind: item.kind as PersonKind,
      id: String(item.id),
      name: item.name,
      role: item.role ?? null,
      photoUrl: safeHttpUrl(item.photoUrl),
      party: item.party ?? null,
    }));
}

export async function getPersonPath(kind: PersonKind, id: string | number): Promise<PersonPath> {
  return mapPersonPath(await request(`/people/${kind}/${encodeURIComponent(String(id))}/path`, personPathSchema, cached));
}

/** The same, or null when it can't be had: the section is then left out instead of breaking the page. */
export async function tryPersonPath(kind: PersonKind, id: string | number): Promise<PersonPath | null> {
  try {
    return await getPersonPath(kind, id);
  } catch {
    return null;
  }
}

export async function getFeaturedPeople(): Promise<FeaturedPerson[]> {
  return mapFeatured(await request("/people/featured", featuredSchema, cached));
}

/** Where a person's own page is on this site. */
export function personHref(kind: PersonKind, id: string): string {
  if (kind === "deputy") return `/deputados/${id}`;
  if (kind === "government") return `/governo/${id}`;
  return "/presidente";
}
