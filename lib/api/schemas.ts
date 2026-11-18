import { z } from "zod";

export const partySchema = z.object({
  slug: z.string(),
  acronym: z.string(),
  name: z.string(),
  website: z.string().nullable(),
  /** Seats now and the latest legislativas; only in the list of parties. */
  assemblySeats: z.number().nullish(),
  lastElection: z
    .object({ id: z.string(), votes: z.number(), validPct: z.number().nullable(), mandates: z.number().nullable(), coalition: z.boolean() })
    .nullish(),
  /** People in office whose deputy record belongs to the party: a lower bound. */
  governmentMembers: z.number().nullish(),
  /** Curated by hand, for the parties with seats. */
  leader: z
    .object({
      name: z.string(),
      title: z.string().nullish(),
      deputyId: z.number().nullish(),
      governmentMemberId: z.string().nullish(),
    })
    .nullish(),
});

const articlePartySchema = partySchema.pick({ slug: true, acronym: true, name: true });

/** Someone named in a news item who has a page here (see the backend's docs/articles-api.md). */
const personMentionSchema = z.object({
  kind: z.enum(["deputy", "government", "president", "local"]),
  id: z.union([z.string(), z.number()]).transform(String),
  name: z.string(),
});
/** Each mention on its own: one we can't read is dropped, the rest still link. */
export const peopleSchema = z
  .array(z.unknown())
  .nullish()
  .transform((items) =>
    (items ?? []).flatMap((item) => {
      const parsed = personMentionSchema.safeParse(item);
      return parsed.success ? [parsed.data] : [];
    }),
  );

export const articleSchema = z.object({
  id: z.number(),
  title: z.string(),
  excerpt: z.string(),
  url: z.string(),
  source: z.string(),
  imageUrl: z.string().nullable(),
  publishedAt: z.string(),
  commentCount: z.number(),
  /** Reads on our article page, one per reader per article per day; while the API doesn't send it, none is shown. */
  views: z.number().nullish(),
  /** Readers' votes; while the API doesn't send them, no voting is shown. */
  upvotes: z.number().nullish(),
  downvotes: z.number().nullish(),
  parties: z.array(articlePartySchema),
  /** The story it belongs to, with the other outlets' versions; null for a few minutes after it is found. */
  storyId: z.number().nullish(),
  /** Initiatives the article mentions; only on the detail. */
  initiatives: z.array(z.object({ id: z.number(), title: z.string() })).nullish(),
  /** Everyone named in it who has a page here, most mentioned first. */
  people: peopleSchema.optional(),
});

export const articlePageSchema = z.object({
  items: z.array(articleSchema),
  nextCursor: z.string().nullable(),
  /** How many articles match the filters, the same on every page. */
  total: z.number().nullish(),
});

export const commentSchema = z.object({
  id: z.number(),
  parentId: z.number().nullable(),
  username: z.string().nullable(),
  body: z.string(),
  createdAt: z.string(),
  /** The commenter's own side on a story ("Concordo"/"Discordo"), and readers' likes. Absent on older APIs. */
  stance: z.enum(["agree", "disagree"]).nullish(),
  likes: z.number().nullish(),
});

const statusSchema = z.enum(["approved", "in_progress", "rejected", "withdrawn"]);
// Optional extras default to empty, so a missing detail never takes the whole page down.
const list = <T extends z.ZodType>(item: T) =>
  z
    .array(item)
    .nullish()
    .transform((value) => value ?? []);

export const deputySummarySchema = z.object({
  id: z.number(),
  name: z.string(),
  group: z.string(),
  party: z.string().nullable(),
  constituency: z.string(),
  seat: z.number().nullish(),
  seatEstimated: z.boolean().nullish(),
  positions: list(z.string()),
  parliamentRole: z.string().nullish(),
  photoUrl: z.string().nullish(),
  gender: z.enum(["M", "F"]).nullish(),
});

export const parliamentSchema = z.object({
  legislature: z.string(),
  updatedAt: z.string().nullable(),
  seatMap: z.object({
    source: z.string(),
    width: z.number().positive(),
    height: z.number().positive(),
    seats: z.array(
      z.object({
        number: z.number(),
        group: z.string(),
        party: z.string(),
        x: z.number(),
        y: z.number(),
        deputyId: z.number().nullish(),
        estimated: z.boolean().nullish(),
      }),
    ),
  }),
  groups: z.array(z.object({ group: z.string(), party: articlePartySchema, seats: z.number() })),
  deputies: z.array(deputySummarySchema),
  initiativeCounts: z.record(z.string(), z.number()).nullish(),
});

export const initiativeSchema = z.object({
  id: z.number(),
  type: z.string(),
  number: z.string().nullish(),
  title: z.string(),
  status: statusSchema,
  phase: z.string().nullish(),
  phaseDate: z.string().nullish(),
  submittedAt: z.string().nullish(),
  publishedAt: z.string().nullish(),
  textUrl: z.string().nullish(),
  authors: z.object({
    parties: list(articlePartySchema),
    deputies: list(z.object({ id: z.number(), name: z.string(), party: z.string().nullable() })),
    other: z.string().nullish(),
  }),
  lastVote: z.object({ date: z.string().nullish(), phase: z.string().nullish(), result: z.string(), unanimous: z.boolean() }).nullish(),
  /** How much news we found about it. Approximate: matched by keywords from the title. */
  coverage: z.object({ articles: z.number(), sources: z.number(), lastAt: z.string().nullish() }).nullish(),
  topics: list(z.object({ slug: z.string(), label: z.string() })),
  plain: z
    .object({
      /** Null when no plain version could be made: the official title is used. */
      title: z.string().nullish(),
      type: z.object({ label: z.string(), explainer: z.string().nullish(), makesLaw: z.boolean().nullish() }),
      status: z.object({ label: z.string(), stage: z.string().nullish() }),
    })
    .nullish(),
  presidency: z
    .object({
      status: z.string(),
      sentAt: z.string().nullish(),
      promulgatedAt: z.string().nullish(),
      /** False when the Parliament's record skips the promulgation, which is then deduced from publication. */
      promulgationRecorded: z.boolean().nullish(),
      vetoedAt: z.string().nullish(),
      vetoKind: z.enum(["political", "unconstitutionality"]).nullish().catch(null),
      constitutionalCourt: z.array(z.object({ ruling: z.string(), url: z.string().nullish() })).nullish(),
      vetoes: z
        .array(
          z.object({
            date: z.string().nullish(),
            kind: z.enum(["political", "unconstitutionality"]).nullish().catch(null),
            constitutionalCourt: z.array(z.object({ ruling: z.string(), url: z.string().nullish() })).nullish(),
          }),
        )
        .nullish(),
      by: z.string().nullish(),
    })
    .nullish(),
});

const positionSchema = z.object({ party: z.string(), count: z.number().nullable() });
// Absences come as bare party slugs (["be"]): nobody counts an absent group's votes. Both shapes are accepted.
const absentSchema = z.union([positionSchema, z.string().transform((party) => ({ party, count: null }))]);

export const initiativeDetailSchema = initiativeSchema.extend({
  legislature: z.string().nullish(),
  articles: list(articleSchema),
  votes: list(
    z.object({
      id: z.string(),
      date: z.string().nullish(),
      phase: z.string().nullish(),
      result: z.string(),
      unanimous: z.boolean(),
      favor: list(positionSchema),
      against: list(positionSchema),
      abstention: list(positionSchema),
      absent: list(absentSchema),
      named: list(z.object({ name: z.string(), group: z.string(), position: z.string() })),
    }),
  ),
});

export const initiativePageSchema = z.object({
  items: z.array(initiativeSchema),
  nextCursor: z.string().nullable(),
  /** How many match the filters, when the API counts them. */
  total: z.number().nullish(),
  stages: z.array(z.object({ key: z.string(), label: z.string(), plain: z.string().nullish(), count: z.number() })).nullish(),
});

export const deputyDetailSchema = deputySummarySchema.extend({
  fullName: z.string(),
  partyInfo: articlePartySchema.nullish(),
  situation: z.string().nullish(),
  active: z.boolean(),
  birthDate: z.string().nullish(),
  profession: z.string().nullish(),
  education: list(z.object({ course: z.string(), completed: z.boolean() })),
  roles: list(z.object({ title: z.string(), current: z.boolean() })),
  committees: list(
    z.object({ name: z.string(), acronym: z.string().nullish(), membership: z.string().nullish(), role: z.string().nullish() }),
  ),
  pastLegislatures: list(z.string()),
  /** Official site, Wikipedia, social accounts and Wikidata: for the page and the structured data's sameAs. */
  links: list(z.object({ network: z.string(), url: z.string() })),
  initiatives: z.object({ total: z.number(), approved: z.number(), latest: list(initiativeSchema) }),
  articles: list(articleSchema),
});

const voteBasisSchema = z.enum(["named", "group", "unanimous", "absent", "unknown"]);

export const deputyVotesPageSchema = z.object({
  summary: z.object({
    favor: z.number(),
    against: z.number(),
    abstention: z.number(),
    absent: z.number(),
    unknown: z.number(),
    brokeRanks: z.number(),
  }),
  items: z.array(
    z.object({
      initiative: z.object({ id: z.number(), type: z.string(), number: z.string().nullish(), title: z.string(), status: statusSchema }),
      vote: z.object({ id: z.string(), date: z.string().nullish(), phase: z.string().nullish(), result: z.string() }),
      position: z.enum(["favor", "against", "abstention"]).nullable(),
      basis: voteBasisSchema,
    }),
  ),
  nextCursor: z.string().nullable(),
});

const memberKindSchema = z.enum(["prime_minister", "minister", "secretary_of_state"]);

export const governmentMemberSchema = z.object({
  id: z.string(),
  name: z.string(),
  title: z.string(),
  kind: memberKindSchema,
  gender: z.enum(["M", "F"]).nullish(),
  photoUrl: z.string().nullish(),
  startDate: z.string().nullish(),
  endDate: z.string().nullish(),
  deputyId: z.number().nullish(),
  party: z.string().nullish(),
  /** Where the party comes from: their deputy record, or a short list of public party membership. */
  partySource: z.enum(["deputy", "curated"]).nullish().catch(null),
  /** True when public record says they belong to no party; false with no party means unknown. */
  independent: z.boolean().nullish(),
  areaName: z.string().nullish(),
});

export const governmentSchema = z.object({
  government: z.object({ code: z.string(), name: z.string(), startDate: z.string().nullish(), updatedAt: z.string().nullish() }),
  primeMinister: governmentMemberSchema.nullable(),
  ministries: list(
    z.object({
      area: z.string(),
      name: z.string(),
      minister: governmentMemberSchema.nullable(),
      secretaries: list(governmentMemberSchema),
    }),
  ),
  former: list(governmentMemberSchema),
});

export const governmentMemberDetailSchema = z.object({
  id: z.string(),
  name: z.string(),
  gender: z.enum(["M", "F"]).nullish(),
  photoUrl: z.string().nullish(),
  bio: list(z.string()),
  links: list(z.object({ network: z.string(), url: z.string() })),
  inOffice: z.boolean(),
  party: z.string().nullish(),
  partySource: z.string().nullish(),
  independent: z.boolean().nullish(),
  deputy: z.object({ id: z.number(), name: z.string(), party: z.string().nullish() }).nullish(),
  positions: list(
    z.object({
      title: z.string(),
      kind: memberKindSchema,
      area: z.string().nullish(),
      areaName: z.string().nullish(),
      government: z.string().nullish(),
      startDate: z.string().nullish(),
      endDate: z.string().nullish(),
      url: z.string().nullish(),
    }),
  ),
  articles: list(articleSchema),
});

const electionTypeSchema = z.enum(["legislativas", "europeias", "presidenciais", "autarquicas"]);
const placeLevelSchema = z.enum(["global", "national", "foreign", "district", "municipality", "parish"]);

const turnoutSchema = z.object({
  registered: z.number().nullish(),
  voters: z.number().nullish(),
  turnoutPct: z.number().nullish(),
  blank: z.number().nullish(),
  null: z.number().nullish(),
  totalMandates: z.number().nullish(),
});

const electionListSchema = z.object({
  list: z.string(),
  name: z.string().nullish(),
  partySlugs: list(z.string()),
  coalition: z.boolean().nullish(),
  citizens: z.boolean().nullish(),
  votes: z.number(),
  pct: z.number().nullish(),
  validPct: z.number().nullish(),
  mandates: z.number().nullish(),
  presidents: z.number().nullish(),
});

const placeSchema = z.object({ key: z.string(), name: z.string(), level: placeLevelSchema, dicofre: z.string().nullish() });

const electionSummarySchema = z.object({
  id: z.string(),
  type: electionTypeSchema,
  name: z.string(),
  date: z.string(),
  organs: list(z.string()),
  sourceUrl: z.string().nullish(),
  /** How far down the results go: older elections often have them only for the country or by district. */
  deepestLevel: z.enum(["country", "district", "municipality", "parish"]).nullish().catch(null),
  /** Presidenciais: 1 or 2. */
  round: z.number().int().nullish().catch(null),
});

export const electionsSchema = z.object({
  items: z.array(
    electionSummarySchema.extend({
      turnout: turnoutSchema.nullish(),
      winner: electionListSchema.nullish(),
      imported: z.boolean().nullish(),
    }),
  ),
  /** The next election of each kind, regionais included; `date` null until the decree sets it. */
  upcoming: list(
    z.object({
      type: z.string(),
      name: z.string(),
      year: z.number().nullish(),
      date: z.string().nullish(),
      confirmed: z.boolean().nullish(),
      window: z.string().nullish(),
      basis: z.string().nullish(),
    }),
  ),
});

export const electionResultSchema = z.object({
  election: electionSummarySchema,
  organ: z.string(),
  place: placeSchema,
  breadcrumb: list(placeSchema),
  turnout: turnoutSchema.nullish(),
  lists: list(electionListSchema),
  children: list(
    placeSchema.extend({
      turnoutPct: z.number().nullish(),
      winner: z.object({ list: z.string(), partySlugs: list(z.string()), votes: z.number(), validPct: z.number().nullish() }).nullish(),
    }),
  ),
});

export const errorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
});

export type ApiParty = z.infer<typeof partySchema>;
export type ApiArticle = z.infer<typeof articleSchema>;
export type ApiComment = z.infer<typeof commentSchema>;
export type ApiDeputySummary = z.infer<typeof deputySummarySchema>;
export type ApiDeputyDetail = z.infer<typeof deputyDetailSchema>;
export type ApiParliament = z.infer<typeof parliamentSchema>;
export type ApiInitiative = z.infer<typeof initiativeSchema>;
export type ApiInitiativeDetail = z.infer<typeof initiativeDetailSchema>;
/** What the API sends, before defaults are applied. Used by the mock API. */
export type ApiParliamentInput = z.input<typeof parliamentSchema>;
export type ApiInitiativeInput = z.input<typeof initiativeSchema>;
export type ApiInitiativeDetailInput = z.input<typeof initiativeDetailSchema>;
export type ApiDeputyDetailInput = z.input<typeof deputyDetailSchema>;
export type ApiDeputyVotesPage = z.infer<typeof deputyVotesPageSchema>;
export type ApiDeputyVotesPageInput = z.input<typeof deputyVotesPageSchema>;
export type ApiGovernment = z.infer<typeof governmentSchema>;
export type ApiGovernmentInput = z.input<typeof governmentSchema>;
export type ApiGovernmentMember = z.infer<typeof governmentMemberSchema>;
export type ApiGovernmentMemberDetail = z.infer<typeof governmentMemberDetailSchema>;
export type ApiGovernmentMemberDetailInput = z.input<typeof governmentMemberDetailSchema>;
export type ApiElections = z.infer<typeof electionsSchema>;
export type ApiElectionsInput = z.input<typeof electionsSchema>;
export type ApiElectionResult = z.infer<typeof electionResultSchema>;
export type ApiElectionResultInput = z.input<typeof electionResultSchema>;

export const governmentHistorySchema = z.object({
  items: z.array(
    z.object({
      code: z.string(),
      kind: z.string(),
      name: z.string(),
      primeMinister: z.string(),
      start: z.string(),
      end: z.string().nullable(),
      days: z.number(),
      parties: z.array(articlePartySchema),
      support: z.string().nullish(),
      endReason: z.string().nullish(),
      endNote: z.string().nullish(),
      portalUrl: z.string().nullish(),
      current: z.boolean().nullish(),
    }),
  ),
  source: z.string().nullish(),
});

export const timelineSchema = z.object({
  items: z.array(
    z.object({
      kind: z.string(),
      date: z.string(),
      endDate: z.string().nullish(),
      title: z.string(),
      detail: z.string().nullish(),
      ref: z.object({ kind: z.string(), id: z.string() }).nullish(),
    }),
  ),
});

export type ApiGovernmentHistory = z.infer<typeof governmentHistorySchema>;
export type ApiGovernmentHistoryInput = z.input<typeof governmentHistorySchema>;
export type ApiTimeline = z.infer<typeof timelineSchema>;
export type ApiTimelineInput = z.input<typeof timelineSchema>;

export const editorialPostSchema = z.object({
  id: z.number(),
  slug: z.string(),
  kind: z.string(),
  title: z.string(),
  subtitle: z.string().nullish(),
  authorName: z.string().nullish(),
  coverImageUrl: z.string().nullish(),
  media: z.object({ provider: z.string(), url: z.string(), embedUrl: z.string() }).nullish(),
  tags: z.array(z.string()).nullish(),
  featured: z.boolean().nullish(),
  publishedAt: z.string(),
  readingMinutes: z.number().int().positive().nullish(),
  /** Reads since publication. */
  views: z.number().nullish(),
  /** Reads over the asked period, only with `sort=popular` (which is ordered by it). */
  recentViews: z.number().nullish(),
  /** Visible comments and readers' votes, once the API sends them on posts (asked of the backend). */
  commentCount: z.number().nullish(),
  /** Readers who marked the post "Importa"; `upvotes` carries the same number while the API sends both. */
  importa: z.number().nullish(),
  upvotes: z.number().nullish(),
});

export const editorialPageSchema = z.object({ items: z.array(editorialPostSchema), total: z.number() });
export const editorialDetailSchema = editorialPostSchema.extend({ body: z.string() });

export type ApiEditorialPost = z.infer<typeof editorialPostSchema>;
export type ApiEditorialPageInput = z.input<typeof editorialPageSchema>;
export type ApiEditorialDetail = z.infer<typeof editorialDetailSchema>;
export type ApiEditorialDetailInput = z.input<typeof editorialDetailSchema>;
