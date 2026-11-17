export type ArticleParty = { slug: string; acronym: string; name: string };

export type Party = ArticleParty & { website: string | null };

export type Article = {
  id: number;
  title: string;
  /** About 300 characters at most, and possibly empty. The API never has the full text. */
  excerpt: string;
  publishedAt: string;
  url: string | null;
  /** The outlet's display name ("Público"). */
  source: string;
  /** Its domain ("publico.pt"), for its logo. */
  sourceDomain: string;
  imageUrl: string | null;
  parties: ArticleParty[];
  commentsCount: number;
  /** Initiatives in Parliament the article mentions (detail only; empty in lists). */
  initiatives: { id: number; title: string }[];
};

/** `total`: how many match, when the API says. */
export type ArticlePage = { articles: Article[]; nextCursor: string | null; total?: number | null };

export type Comment = {
  id: number;
  username: string | null;
  text: string;
  parentId: number | null;
  createdAt: string | null;
  /** Shown while an optimistic comment is waiting for the API. */
  pending?: boolean;
};

/** Where comments live in the API: "/articles/100" for a news article, "/editorial/<slug>" for one of our posts. */
export type CommentTarget = string;
export const articleComments = (id: number): CommentTarget => `/articles/${id}`;
export const postComments = (slug: string): CommentTarget => `/editorial/${encodeURIComponent(slug)}`;

export type NewComment = {
  target: CommentTarget;
  parentId: number | null;
  username: string;
  text: string;
  captchaToken: string;
};

/** One of the 230 seats on the official map (Deliberação n.º 5-PL/2025). */
export type ParliamentSeat = {
  number: number;
  /** The Parliament's group acronym, such as "PS" or "L". */
  group: string;
  partySlug: string;
  /** Floor position: x from 0 (left) to 1, y from 0 (back row) to the map height (front, near the Mesa). */
  x: number;
  y: number;
  /** Who sits here, when known. */
  deputyId: number | null;
  /** True when who sits here is the backend's estimate (by importance), not official seating. */
  estimated: boolean;
};

export type ParliamentGroup = { group: string; party: ArticleParty; seats: number };

/** A sitting deputy. `id` is the Parliament's permanent person id. */
export type DeputySummary = {
  id: number;
  name: string;
  group: string;
  /** Null for independents. */
  partySlug: string | null;
  constituency: string;
  seat: number | null;
  /** True when the seat is estimated rather than official. */
  seatEstimated: boolean;
  /** Official posts, most important first, such as "Líder do grupo parlamentar". */
  positions: string[];
  /** A post in the chamber's leadership, such as "Vice-Presidente". */
  role: string | null;
  photoUrl: string | null;
};

export type InitiativeStatus = "approved" | "in_progress" | "rejected" | "withdrawn";

export type Parliament = {
  legislature: string;
  updatedAt: string | null;
  seatMap: { source: string; width: number; height: number; seats: ParliamentSeat[] };
  /** Left to right, as in the chamber. */
  groups: ParliamentGroup[];
  deputies: DeputySummary[];
  initiativeCounts: Partial<Record<InitiativeStatus, number>>;
};

export type Initiative = {
  id: number;
  type: string;
  number: string | null;
  title: string;
  status: InitiativeStatus;
  phase: string | null;
  phaseDate: string | null;
  submittedAt: string | null;
  publishedAt: string | null;
  textUrl: string | null;
  authors: { parties: ArticleParty[]; deputies: { id: number; name: string; partySlug: string | null }[]; other: string | null };
  lastVote: { date: string | null; phase: string | null; result: string; unanimous: boolean } | null;
  /** News found about it. Approximate (matched by keywords), so the UI calls it "related". */
  coverage: { articles: number; sources: number; lastAt: string | null };
  /** Subjects found in the title; empty when none fits. */
  topics: InitiativeTopic[];
  /** The plain-language reading, from fixed rules; null when the API has none. */
  plain: PlainInitiative | null;
  /** What the President did with it; null until Parliament sends it to Belém. */
  presidency: InitiativePresidency | null;
};

export type InitiativeTopic = { slug: string; label: string };

/** Where an initiative stands, for the progress bar. */
export type PlainStage =
  | "submitted"
  | "committee"
  | "consultation"
  | "debate"
  | "approved_in_principle"
  | "approved"
  | "awaiting_president"
  | "vetoed"
  | "promulgated"
  | "published"
  | "rejected"
  | "not_admitted"
  | "withdrawn";

export type PlainInitiative = {
  /** The title without the legal boilerplate. */
  title: string;
  /** What kind of initiative this is; `makesLaw` false means approving it changes no law. */
  type: { label: string; explainer: string; makesLaw: boolean };
  /** `stage` null when the API sends one we don't know. */
  status: { label: string; stage: PlainStage | null };
};

export type PresidencyStatus = "pending" | "promulgated" | "vetoed";

/** "unconstitutionality": vetoed after the Constitutional Court found it unconstitutional. */
export type VetoKind = "political" | "unconstitutionality";
export type CourtRuling = { ruling: string; url: string | null };

export type InitiativePresidency = {
  status: PresidencyStatus;
  sentAt: string | null;
  promulgatedAt: string | null;
  /** Kept after a veto that Parliament overcame, so "vetado e depois promulgado" can be shown. */
  /**
   * False when the Parliament's record skips the promulgation: it is deduced from publication in the Diário da
   * República, and `promulgatedAt` is null, so the publication date is shown instead.
   */
  promulgationRecorded: boolean;
  vetoedAt: string | null;
  /** The latest veto's kind, and the rulings it cites. */
  vetoKind: VetoKind | null;
  constitutionalCourt: CourtRuling[];
  /** Every veto, oldest first. */
  vetoes: { date: string | null; kind: VetoKind | null; constitutionalCourt: CourtRuling[] }[];
  by: string | null;
};

/** One phase with how many initiatives are in it, counted with every filter but the phase. */
export type InitiativeStageCount = { key: string; label: string; plain: string; count: number };

export type InitiativePage = {
  initiatives: Initiative[];
  nextCursor: string | null;
  /** How many match the filters; null when the API doesn't count them. */
  total: number | null;
  stages: InitiativeStageCount[];
};

/** A party's position in a vote. `count` null means the whole group; a number means only that many deputies. */
export type VotePosition = { partySlug: string; count: number | null };

export type Vote = {
  id: string;
  date: string | null;
  phase: string | null;
  result: string;
  unanimous: boolean;
  favor: VotePosition[];
  against: VotePosition[];
  abstention: VotePosition[];
  /** Groups recorded as absent. */
  absent: VotePosition[];
  /** Deputies the Parliament names because they voted apart from their group. */
  named: { name: string; group: string; position: string }[];
};

export type InitiativeDetail = Initiative & { legislature: string | null; votes: Vote[]; articles: Article[] };

/**
 * How a deputy's position in a vote is known. The Parliament records votes by group, so most come from the
 * group; "named" ones are where the record names them, because they voted apart from it.
 */
export type VoteBasis = "named" | "group" | "unanimous" | "absent" | "unknown";

export type DeputyVote = {
  initiative: { id: number; type: string; number: string | null; title: string; status: InitiativeStatus };
  vote: { id: string; date: string | null; phase: string | null; result: string };
  position: "favor" | "against" | "abstention" | null;
  basis: VoteBasis;
};

export type DeputyVotesPage = {
  summary: { favor: number; against: number; abstention: number; absent: number; unknown: number; brokeRanks: number };
  votes: DeputyVote[];
  nextCursor: string | null;
};

export type GovernmentMemberKind = "prime_minister" | "minister" | "secretary_of_state";

/** A member of the Government. Not a deputy: ids are the Government portal's. */
export type GovernmentMember = {
  id: string;
  name: string;
  title: string;
  kind: GovernmentMemberKind;
  gender: "M" | "F" | null;
  photoUrl: string | null;
  startDate: string | null;
  endDate: string | null;
  /** Set when they were elected to this legislature and left their seat to join the Government. */
  deputyId: number | null;
  /** Null when unknown: the Government's portal doesn't publish it. */
  partySlug: string | null;
  /** "deputy": they were elected for it; "curated": public party membership. */
  partySource: "deputy" | "curated" | null;
  /** Public record says they belong to no party. Without it, no party means unknown, never "independente". */
  independent: boolean;
  /** For former members: the ministry they were in. */
  areaName: string | null;
};

export type Government = {
  code: string;
  name: string;
  startDate: string | null;
  updatedAt: string | null;
  primeMinister: GovernmentMember | null;
  ministries: { area: string; name: string; minister: GovernmentMember | null; secretaries: GovernmentMember[] }[];
  former: GovernmentMember[];
};

export type GovernmentMemberDetail = {
  id: string;
  name: string;
  gender: "M" | "F" | null;
  photoUrl: string | null;
  bio: string[];
  links: { network: string; url: string }[];
  inOffice: boolean;
  /** Null when unknown; see GovernmentMember. */
  partySlug: string | null;
  partySource: "deputy" | "curated" | null;
  independent: boolean;
  deputy: { id: number; name: string; partySlug: string | null } | null;
  positions: {
    title: string;
    kind: GovernmentMemberKind;
    areaName: string | null;
    government: string | null;
    startDate: string | null;
    endDate: string | null;
    url: string | null;
  }[];
  articles: Article[];
};

export type DeputyDetail = DeputySummary & {
  fullName: string;
  party: ArticleParty | null;
  situation: string | null;
  active: boolean;
  birthDate: string | null;
  profession: string | null;
  education: { course: string; completed: boolean }[];
  roles: { title: string; current: boolean }[];
  committees: { name: string; acronym: string | null; membership: string | null; role: string | null }[];
  pastLegislatures: string[];
  initiatives: { total: number; approved: number; latest: Initiative[] };
  articles: Article[];
};

export type ElectionType = "legislativas" | "europeias" | "presidenciais" | "autarquicas";
export type PlaceLevel = "global" | "national" | "foreign" | "district" | "municipality" | "parish";

export type ElectionTurnout = {
  registered: number | null;
  voters: number | null;
  turnoutPct: number | null;
  blank: number | null;
  null: number | null;
  totalMandates: number | null;
};

/** A list on the ballot: a party, a coalition, a citizens' group or, in presidenciais, a candidate. */
export type ElectionList = {
  list: string;
  name: string;
  /** Our parties in it, for colours and links; empty when none of ours is. */
  partySlugs: string[];
  coalition: boolean;
  citizens: boolean;
  votes: number;
  pct: number | null;
  /** Share of valid votes: the usual headline figure. */
  validPct: number | null;
  mandates: number | null;
  /** Autárquicas: câmaras or juntas won inside the place. */
  presidents: number | null;
};

export type Place = { key: string; name: string; level: PlaceLevel; dicofre: string | null };

export type ElectionSummary = {
  id: string;
  type: ElectionType;
  name: string;
  date: string;
  organs: string[];
  sourceUrl: string | null;
  /** How far down the results go; null when the API doesn't say (then as far as there are places). */
  deepestLevel: "country" | "district" | "municipality" | "parish" | null;
  /** Presidenciais: the first or second round; null otherwise. */
  round: number | null;
};

/** A coming election: its date once the decree sets it (`confirmed`), else when the law says it must happen. */
export type UpcomingElection = {
  type: string;
  name: string;
  year: number | null;
  date: string | null;
  confirmed: boolean;
  /** "Entre 14 de setembro e 14 de outubro de 2029, no fim da legislatura, salvo dissolução". */
  window: string | null;
  basis: string | null;
};

export type Election = ElectionSummary & { turnout: ElectionTurnout | null; winner: ElectionList | null; imported: boolean };

export type ElectionResult = {
  election: ElectionSummary;
  organ: string;
  place: Place;
  breadcrumb: Place[];
  turnout: ElectionTurnout | null;
  /** Most votes first. */
  lists: ElectionList[];
  /** The places inside, alphabetical; empty at the deepest level. */
  children: (Place & {
    turnoutPct: number | null;
    winner: { list: string; partySlugs: string[]; votes: number; validPct: number | null } | null;
  })[];
};

/** How a party did: its seats in Parliament and its votes in the latest legislativas. */
/** A party on the parties page: who leads it, its seats now and its latest legislativas. */
export type PartyOverview = Party & {
  seats: number;
  /** The latest legislativas; `coalition`: the votes are the coalition's, shared with its partners. */
  lastElection: { id: string; votes: number; validPct: number | null; mandates: number | null; coalition: boolean } | null;
  governmentMembers: number;
  /** `href`: their deputy or Government page, when we have one. */
  leader: { name: string; title: string | null; href: string | null } | null;
};

export type PartyStanding = {
  seats: number;
  votes: number;
  validPct: number;
  /** Ran in a coalition: the votes are the coalition's, shared with its partners, never to be added up. */
  coalition: boolean;
};

export type GovernmentEndReason =
  | "end_of_term"
  | "early_election"
  | "censure"
  | "confidence_rejected"
  | "programme_rejected"
  | "resignation"
  | "dismissed"
  | "death"
  | "provisional"
  | "in_office";

/** One of the governments since 1974, newest first in lists. */
export type HistoricalGovernment = {
  /** "gc01"–"gc25" constitutional, "gp1"–"gp6" provisional. */
  code: string;
  kind: "constitutional" | "provisional";
  name: string;
  primeMinister: string;
  start: string;
  /** The next government's first day; null while in office. */
  end: string | null;
  days: number;
  parties: ArticleParty[];
  support: string | null;
  /** Null when the API sends a reason this site doesn't know yet. */
  endReason: GovernmentEndReason | null;
  endNote: string | null;
  portalUrl: string | null;
  current: boolean;
};

export type GovernmentHistory = { governments: HistoricalGovernment[]; source: string | null };

/** An election or a President's term on the timeline. Kinds this site doesn't know are dropped. */
export type TimelineEvent = {
  kind: "election" | "president";
  date: string;
  endDate: string | null;
  title: string;
  detail: string | null;
  /** The election's id, when the site has its results. */
  electionId: string | null;
};

export type EditorialKind = "article" | "opinion" | "podcast" | "interview" | "video";

/** One of our own posts: an article, opinion, podcast, interview or video. */
export type EditorialPost = {
  id: number;
  slug: string;
  kind: EditorialKind;
  title: string;
  subtitle: string | null;
  authorName: string | null;
  coverImageUrl: string | null;
  /** An embedded player, only from the allowed providers. */
  media: { provider: string; url: string; embedUrl: string } | null;
  tags: string[];
  featured: boolean;
  publishedAt: string;
  /** Words ÷ 200, rounded up; null when the API doesn't say. */
  readingMinutes: number | null;
  /** Reads in the last days, when the API counts them (`sort=popular`). */
  views?: number | null;
};

export type EditorialDetail = EditorialPost & { body: string };
export type EditorialPage = { items: EditorialPost[]; total: number };
