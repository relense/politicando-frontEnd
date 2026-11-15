import { decode } from "he";
import type {
  Article,
  Comment,
  Election,
  ElectionList,
  ElectionResult,
  ElectionTurnout,
  Place,
  DeputyDetail,
  DeputySummary,
  DeputyVotesPage,
  Government,
  GovernmentMember,
  GovernmentMemberDetail,
  Initiative,
  InitiativeDetail,
  PlainStage,
  PresidencyStatus,
  Parliament,
  Party,
  PartyOverview,
  PartyStanding,
  GovernmentEndReason,
  GovernmentHistory,
  TimelineEvent,
  EditorialDetail,
  EditorialKind,
  EditorialPost,
} from "@/lib/types";
import { sourceName } from "@/lib/sources";
import type {
  ApiArticle,
  ApiComment,
  ApiDeputyDetail,
  ApiDeputySummary,
  ApiDeputyVotesPage,
  ApiElectionResult,
  ApiElections,
  ApiGovernment,
  ApiGovernmentMember,
  ApiGovernmentMemberDetail,
  ApiInitiative,
  ApiInitiativeDetail,
  ApiParliament,
  ApiParty,
  ApiGovernmentHistory,
  ApiTimeline,
  ApiEditorialDetail,
  ApiEditorialPost,
} from "./schemas";

/** External URLs reach the page as href/src, so only http(s) may pass. */
export function safeHttpUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:" ? value : null;
  } catch {
    return null;
  }
}

/** Some sources put markup in their summaries. Decoding first also catches encoded tags. */
function plainText(value: string): string {
  return decode(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function mapParty(party: ApiParty): Party {
  return { slug: party.slug, acronym: party.acronym, name: party.name, website: safeHttpUrl(party.website) };
}

export function mapPartyOverview(party: ApiParty): PartyOverview {
  const leader = party.leader;
  return {
    ...mapParty(party),
    seats: party.assemblySeats ?? 0,
    lastElection: party.lastElection ?? null,
    governmentMembers: party.governmentMembers ?? 0,
    leader: leader
      ? {
          name: leader.name,
          title: leader.title ?? null,
          href: leader.deputyId
            ? `/deputados/${leader.deputyId}`
            : leader.governmentMemberId && /^[0-9a-f]{32}$/.test(leader.governmentMemberId)
              ? `/governo/${leader.governmentMemberId}`
              : null,
        }
      : null,
  };
}

/** Seats now and votes in the latest legislativas, when the API sends them; null for a party with neither. */
export function mapPartyStanding(party: ApiParty): PartyStanding | null {
  const seats = party.assemblySeats ?? 0;
  const election = party.lastElection;
  if (seats === 0 && !election) return null;
  return { seats, votes: election?.votes ?? 0, validPct: election?.validPct ?? 0, coalition: election?.coalition ?? false };
}

export function mapArticle(article: ApiArticle): Article {
  return {
    id: article.id,
    // Text comes from outside sources. Decode entities and always render as text, never as HTML.
    title: decode(article.title),
    excerpt: plainText(article.excerpt),
    publishedAt: article.publishedAt,
    url: safeHttpUrl(article.url),
    source: sourceName(article.source),
    imageUrl: safeHttpUrl(article.imageUrl),
    parties: article.parties,
    commentsCount: article.commentCount,
  };
}

export function mapComment(comment: ApiComment): Comment {
  return {
    id: comment.id,
    username: comment.username || null,
    text: comment.body,
    parentId: comment.parentId,
    createdAt: comment.createdAt,
  };
}

/** The Parliament's files link to documents over http://; its servers also answer on https. */
function secureUrl(value: string | null | undefined): string | null {
  const url = safeHttpUrl(value);
  return url?.startsWith("http://") ? `https://${url.slice("http://".length)}` : url;
}

export function mapDeputySummary(deputy: ApiDeputySummary): DeputySummary {
  return {
    id: deputy.id,
    name: deputy.name,
    group: deputy.group,
    partySlug: deputy.party,
    constituency: deputy.constituency,
    seat: deputy.seat ?? null,
    seatEstimated: deputy.seatEstimated ?? false,
    positions: deputy.positions.map(plainText).filter(Boolean),
    role: deputy.parliamentRole ?? null,
    photoUrl: secureUrl(deputy.photoUrl),
  };
}

export function mapParliament(parliament: ApiParliament): Parliament {
  return {
    legislature: parliament.legislature,
    updatedAt: parliament.updatedAt,
    seatMap: {
      ...parliament.seatMap,
      seats: parliament.seatMap.seats.map(({ party, deputyId, estimated, ...seat }) => ({
        ...seat,
        partySlug: party,
        deputyId: deputyId ?? null,
        estimated: estimated ?? false,
      })),
    },
    groups: parliament.groups,
    deputies: parliament.deputies.map(mapDeputySummary),
    initiativeCounts: parliament.initiativeCounts ?? {},
  };
}

export function mapInitiative(initiative: ApiInitiative): Initiative {
  return {
    id: initiative.id,
    type: initiative.type,
    number: initiative.number ?? null,
    title: plainText(initiative.title),
    status: initiative.status,
    phase: initiative.phase ?? null,
    phaseDate: initiative.phaseDate ?? null,
    submittedAt: initiative.submittedAt ?? null,
    publishedAt: initiative.publishedAt ?? null,
    textUrl: secureUrl(initiative.textUrl),
    authors: {
      parties: initiative.authors.parties,
      deputies: initiative.authors.deputies.map(({ party, ...author }) => ({ ...author, partySlug: party })),
      other: initiative.authors.other ?? null,
    },
    lastVote: initiative.lastVote
      ? { ...initiative.lastVote, date: initiative.lastVote.date ?? null, phase: initiative.lastVote.phase ?? null }
      : null,
    coverage: {
      articles: initiative.coverage?.articles ?? 0,
      sources: initiative.coverage?.sources ?? 0,
      lastAt: initiative.coverage?.lastAt ?? null,
    },
    topics: initiative.topics,
    plain: initiative.plain
      ? {
          title: plainText(initiative.plain.title),
          type: {
            label: initiative.plain.type.label,
            explainer: initiative.plain.type.explainer ?? "",
            makesLaw: initiative.plain.type.makesLaw ?? true,
          },
          status: { label: initiative.plain.status.label, stage: knownStage(initiative.plain.status.stage) },
        }
      : null,
    presidency:
      initiative.presidency && PRESIDENCY_STATUSES.includes(initiative.presidency.status as PresidencyStatus)
        ? {
            status: initiative.presidency.status as PresidencyStatus,
            sentAt: initiative.presidency.sentAt ?? null,
            promulgatedAt: initiative.presidency.promulgatedAt ?? null,
            vetoedAt: initiative.presidency.vetoedAt ?? null,
            by: initiative.presidency.by ?? null,
          }
        : null,
  };
}

const PRESIDENCY_STATUSES: readonly PresidencyStatus[] = ["pending", "promulgated", "vetoed"];
const STAGES: readonly PlainStage[] = [
  "submitted",
  "committee",
  "consultation",
  "debate",
  "approved_in_principle",
  "approved",
  "awaiting_president",
  "vetoed",
  "promulgated",
  "published",
  "rejected",
  "not_admitted",
  "withdrawn",
];
const knownStage = (stage: string | null | undefined): PlainStage | null =>
  stage && STAGES.includes(stage as PlainStage) ? (stage as PlainStage) : null;

export function mapInitiativeDetail(initiative: ApiInitiativeDetail): InitiativeDetail {
  const positions = (list: { party: string; count: number | null }[]) => list.map(({ party, count }) => ({ partySlug: party, count }));
  return {
    ...mapInitiative(initiative),
    legislature: initiative.legislature ?? null,
    votes: initiative.votes.map((vote) => ({
      id: vote.id,
      date: vote.date ?? null,
      phase: vote.phase ?? null,
      result: vote.result,
      unanimous: vote.unanimous,
      favor: positions(vote.favor),
      against: positions(vote.against),
      abstention: positions(vote.abstention),
      absent: positions(vote.absent),
      named: vote.named,
    })),
    articles: initiative.articles.map(mapArticle),
  };
}

export function mapDeputyDetail(deputy: ApiDeputyDetail): DeputyDetail {
  return {
    ...mapDeputySummary(deputy),
    fullName: deputy.fullName,
    party: deputy.partyInfo ?? null,
    situation: deputy.situation ?? null,
    active: deputy.active,
    birthDate: deputy.birthDate ?? null,
    profession: deputy.profession ?? null,
    education: deputy.education,
    roles: deputy.roles,
    committees: deputy.committees.map((committee) => ({
      name: committee.name,
      acronym: committee.acronym ?? null,
      membership: committee.membership ?? null,
      role: committee.role ?? null,
    })),
    pastLegislatures: deputy.pastLegislatures,
    initiatives: { ...deputy.initiatives, latest: deputy.initiatives.latest.map(mapInitiative) },
    articles: deputy.articles.map(mapArticle),
  };
}

export function mapDeputyVotes(page: ApiDeputyVotesPage): DeputyVotesPage {
  return {
    summary: page.summary,
    votes: page.items.map((item) => ({
      initiative: { ...item.initiative, number: item.initiative.number ?? null, title: plainText(item.initiative.title) },
      vote: { ...item.vote, date: item.vote.date ?? null, phase: item.vote.phase ?? null },
      position: item.position,
      basis: item.basis,
    })),
    nextCursor: page.nextCursor,
  };
}

export function mapGovernmentMember(member: ApiGovernmentMember): GovernmentMember {
  return {
    id: member.id,
    name: member.name,
    title: member.title,
    kind: member.kind,
    gender: member.gender ?? null,
    photoUrl: secureUrl(member.photoUrl),
    startDate: member.startDate ?? null,
    endDate: member.endDate ?? null,
    deputyId: member.deputyId ?? null,
    partySlug: member.party ?? null,
    areaName: member.areaName ?? null,
  };
}

export function mapGovernment(data: ApiGovernment): Government {
  return {
    code: data.government.code,
    name: data.government.name,
    startDate: data.government.startDate ?? null,
    updatedAt: data.government.updatedAt ?? null,
    primeMinister: data.primeMinister ? mapGovernmentMember(data.primeMinister) : null,
    ministries: data.ministries.map((ministry) => ({
      area: ministry.area,
      name: ministry.name,
      minister: ministry.minister ? mapGovernmentMember(ministry.minister) : null,
      secretaries: ministry.secretaries.map(mapGovernmentMember),
    })),
    former: data.former.map(mapGovernmentMember),
  };
}

export function mapGovernmentMemberDetail(member: ApiGovernmentMemberDetail): GovernmentMemberDetail {
  return {
    id: member.id,
    name: member.name,
    gender: member.gender ?? null,
    photoUrl: secureUrl(member.photoUrl),
    bio: member.bio.map(plainText).filter(Boolean),
    links: member.links.flatMap((link) => {
      const url = safeHttpUrl(link.url);
      return url ? [{ network: link.network, url }] : [];
    }),
    inOffice: member.inOffice,
    deputy: member.deputy ? { id: member.deputy.id, name: member.deputy.name, partySlug: member.deputy.party ?? null } : null,
    positions: member.positions.map((position) => ({
      title: position.title,
      kind: position.kind,
      areaName: position.areaName ?? null,
      government: position.government ?? null,
      startDate: position.startDate ?? null,
      endDate: position.endDate ?? null,
      url: safeHttpUrl(position.url),
    })),
    articles: member.articles.map(mapArticle),
  };
}

type ApiTurnout = NonNullable<ApiElectionResult["turnout"]>;
type ApiElectionList = ApiElectionResult["lists"][number];
type ApiPlace = ApiElectionResult["place"];

const mapTurnout = (turnout: ApiTurnout | null | undefined): ElectionTurnout | null =>
  turnout
    ? {
        registered: turnout.registered ?? null,
        voters: turnout.voters ?? null,
        turnoutPct: turnout.turnoutPct ?? null,
        blank: turnout.blank ?? null,
        null: turnout.null ?? null,
        totalMandates: turnout.totalMandates ?? null,
      }
    : null;

/** A list with more than one of our parties is a coalition, whatever the flag says. */
const mapElectionList = (item: ApiElectionList): ElectionList => ({
  list: item.list,
  name: item.name?.trim() || item.list,
  partySlugs: item.partySlugs,
  coalition: Boolean(item.coalition) || item.partySlugs.length > 1,
  citizens: Boolean(item.citizens),
  votes: item.votes,
  pct: item.pct ?? null,
  validPct: item.validPct ?? null,
  mandates: item.mandates ?? null,
  presidents: item.presidents ?? null,
});

const mapPlace = (place: ApiPlace): Place => ({ key: place.key, name: place.name, level: place.level, dicofre: place.dicofre ?? null });

const mapElectionSummary = (election: ApiElectionResult["election"]) => ({
  id: election.id,
  type: election.type,
  name: election.name,
  date: election.date,
  organs: election.organs,
  sourceUrl: safeHttpUrl(election.sourceUrl),
});

export function mapElections(api: ApiElections): Election[] {
  return api.items.map((item) => ({
    ...mapElectionSummary(item),
    turnout: mapTurnout(item.turnout),
    winner: item.winner ? mapElectionList(item.winner) : null,
    imported: item.imported ?? true,
  }));
}

export function mapElectionResult(api: ApiElectionResult): ElectionResult {
  return {
    election: mapElectionSummary(api.election),
    organ: api.organ,
    place: mapPlace(api.place),
    breadcrumb: api.breadcrumb.map(mapPlace),
    turnout: mapTurnout(api.turnout),
    lists: api.lists.map(mapElectionList),
    children: api.children.map((child) => ({
      ...mapPlace(child),
      turnoutPct: child.turnoutPct ?? null,
      winner: child.winner ? { ...child.winner, validPct: child.winner.validPct ?? null } : null,
    })),
  };
}

const END_REASONS: readonly GovernmentEndReason[] = [
  "end_of_term",
  "early_election",
  "censure",
  "confidence_rejected",
  "programme_rejected",
  "resignation",
  "dismissed",
  "death",
  "provisional",
  "in_office",
];

export function mapGovernmentHistory(api: ApiGovernmentHistory): GovernmentHistory {
  return {
    governments: api.items.map((item) => ({
      code: item.code,
      kind: item.kind === "provisional" ? "provisional" : "constitutional",
      name: item.name,
      primeMinister: item.primeMinister,
      start: item.start,
      end: item.end,
      days: item.days,
      parties: item.parties,
      support: item.support ?? null,
      endReason: END_REASONS.find((reason) => reason === item.endReason) ?? null,
      endNote: item.endNote ?? null,
      portalUrl: safeHttpUrl(item.portalUrl),
      current: item.current ?? item.end === null,
    })),
    source: safeHttpUrl(api.source),
  };
}

/** Governments come from their own endpoint; editorial kinds planned for later are dropped until the site knows them. */
export function mapTimeline(api: ApiTimeline): TimelineEvent[] {
  return api.items.flatMap((item) =>
    item.kind === "election" || item.kind === "president"
      ? [
          {
            kind: item.kind,
            date: item.date,
            endDate: item.endDate ?? null,
            title: item.title,
            detail: item.detail ?? null,
            electionId: item.ref?.kind === "election" ? item.ref.id : null,
          },
        ]
      : [],
  );
}

const EDITORIAL_KINDS: readonly EditorialKind[] = ["article", "opinion", "podcast", "interview", "video"];

/** Players we allow in an iframe, matching the API's list; anything else is dropped. */
const EMBED_HOSTS = ["www.youtube-nocookie.com", "player.vimeo.com", "open.spotify.com", "w.soundcloud.com", "embed.podcasts.apple.com"];

export function safeEmbedUrl(value: string | null | undefined): string | null {
  const url = safeHttpUrl(value);
  if (!url) return null;
  const parsed = new URL(url);
  return parsed.protocol === "https:" && EMBED_HOSTS.includes(parsed.hostname) ? url : null;
}

export function mapEditorialPost(api: ApiEditorialPost): EditorialPost {
  const embedUrl = safeEmbedUrl(api.media?.embedUrl);
  return {
    id: api.id,
    slug: api.slug,
    kind: EDITORIAL_KINDS.find((kind) => kind === api.kind) ?? "article",
    title: decode(api.title),
    subtitle: api.subtitle ? decode(api.subtitle) : null,
    authorName: api.authorName?.trim() || null,
    coverImageUrl: safeHttpUrl(api.coverImageUrl),
    media: api.media && embedUrl ? { provider: api.media.provider, url: safeHttpUrl(api.media.url) ?? embedUrl, embedUrl } : null,
    tags: api.tags ?? [],
    featured: api.featured ?? false,
    publishedAt: api.publishedAt,
  };
}

export function mapEditorialDetail(api: ApiEditorialDetail): EditorialDetail {
  return { ...mapEditorialPost(api), body: api.body };
}
