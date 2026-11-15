import { decode } from "he";
import type { Article, Comment, DeputyDetail, DeputySummary, Initiative, InitiativeDetail, Parliament, Party } from "@/lib/types";
import { sourceName } from "@/lib/sources";
import type {
  ApiArticle,
  ApiComment,
  ApiDeputyDetail,
  ApiDeputySummary,
  ApiInitiative,
  ApiInitiativeDetail,
  ApiParliament,
  ApiParty,
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
      seats: parliament.seatMap.seats.map(({ party, deputyId, ...seat }) => ({ ...seat, partySlug: party, deputyId: deputyId ?? null })),
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
  };
}

export function mapInitiativeDetail(initiative: ApiInitiativeDetail): InitiativeDetail {
  const positions = (list: { party: string; count: number | null }[]) => list.map(({ party, count }) => ({ partySlug: party, count }));
  return {
    ...mapInitiative(initiative),
    votes: initiative.votes.map((vote) => ({
      id: vote.id,
      date: vote.date ?? null,
      phase: vote.phase ?? null,
      result: vote.result,
      unanimous: vote.unanimous,
      favor: positions(vote.favor),
      against: positions(vote.against),
      abstention: positions(vote.abstention),
      named: vote.named,
    })),
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
