export type ArticleParty = { slug: string; acronym: string; name: string };

export type Party = ArticleParty & { website: string | null };

export type Article = {
  id: number;
  title: string;
  /** About 300 characters at most, and possibly empty. The API never has the full text. */
  excerpt: string;
  publishedAt: string;
  url: string | null;
  source: string;
  imageUrl: string | null;
  parties: ArticleParty[];
  commentsCount: number;
};

export type ArticlePage = { articles: Article[]; nextCursor: string | null };

export type Comment = {
  id: number;
  username: string | null;
  text: string;
  parentId: number | null;
  createdAt: string | null;
  /** Shown while an optimistic comment is waiting for the API. */
  pending?: boolean;
};

export type NewComment = {
  articleId: number;
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
};

export type InitiativePage = { initiatives: Initiative[]; nextCursor: string | null };

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

export type InitiativeDetail = Initiative & { votes: Vote[]; articles: Article[] };

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
  /** Only known through a deputy record; most members' party isn't published. */
  partySlug: string | null;
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
