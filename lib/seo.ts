import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "./site";

/**
 * What every page's Open Graph block repeats. Next merges metadata shallowly: a page that sets `openGraph` replaces
 * the layout's whole block, so it spreads this in to keep the site's name and language.
 */
export const OG_BASE = { siteName: SITE_NAME, locale: "pt_PT" } as const;

/** Search engines show about 155 characters of a description; longer ones are cut mid-word. */
export function clip(text: string, max = 155): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(" ") > max * 0.6 ? cut.lastIndexOf(" ") : cut.length).replace(/[,;:.\s]+$/, "")}…`;
}

export const absolute = (path: string) => (/^https?:\/\//.test(path) ? path : `${SITE_URL}${path}`);

/** JSON-LD for a <script> tag: "<" escaped, so text from the data can never close the tag. */
export const jsonLd = (data: unknown) => JSON.stringify(data).replace(/</g, "\\u003c");

/** Google shows these as the page's path in results ("Politicando › Parlamento › …"). */
export function breadcrumbs(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: item.name, item: absolute(item.path) })),
  };
}

/** Who publishes the site, and the site itself: on every page, through the layout. */
export const siteLd = () => [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}/#organizacao`,
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/icon`,
    description: SITE_DESCRIPTION,
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#site`,
    name: SITE_NAME,
    url: SITE_URL,
    inLanguage: "pt-PT",
    description: SITE_DESCRIPTION,
    publisher: { "@id": `${SITE_URL}/#organizacao` },
  },
];

const PARLIAMENT = { "@type": "GovernmentOrganization", name: "Assembleia da República", url: "https://www.parlamento.pt" };

/** A deputy or a member of the Government: who they are, their office and their party. */
export function personLd(person: {
  path: string;
  name: string;
  fullName?: string | null;
  jobTitle?: string | null;
  photoUrl?: string | null;
  party?: { name: string; acronym: string; slug: string } | null;
  worksFor?: "parliament" | "government";
  sameAs?: string[];
  /** The "Quem é" text: who they are, from their records. */
  description?: string | null;
  birthDate?: string | null;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": `${absolute(person.path)}#pessoa`,
    name: person.name,
    ...(person.fullName && person.fullName !== person.name ? { alternateName: person.fullName } : {}),
    url: absolute(person.path),
    ...(person.jobTitle ? { jobTitle: person.jobTitle } : {}),
    ...(person.description ? { description: person.description } : {}),
    ...(person.birthDate && /^\d{4}-\d{2}-\d{2}/.test(person.birthDate) ? { birthDate: person.birthDate.slice(0, 10) } : {}),
    nationality: { "@type": "Country", name: "Portugal" },
    ...(person.photoUrl ? { image: absolute(person.photoUrl) } : {}),
    ...(person.party
      ? {
          memberOf: {
            "@type": "PoliticalParty",
            name: person.party.name,
            alternateName: person.party.acronym,
            url: absolute(`/partido/${person.party.slug}`),
          },
        }
      : {}),
    ...(person.worksFor === "parliament"
      ? { worksFor: PARLIAMENT }
      : person.worksFor === "government"
        ? { worksFor: { "@type": "GovernmentOrganization", name: "Governo de Portugal", url: "https://www.portugal.gov.pt" } }
        : {}),
    ...(person.sameAs && person.sameAs.length > 0 ? { sameAs: person.sameAs } : {}),
  };
}

export function partyLd(party: { path: string; name: string; acronym: string; website: string | null; description?: string | null }) {
  return {
    "@context": "https://schema.org",
    "@type": "PoliticalParty",
    "@id": `${absolute(party.path)}#partido`,
    name: party.name,
    alternateName: party.acronym,
    url: absolute(party.path),
    ...(party.description ? { description: party.description } : {}),
    ...(party.website ? { sameAs: [party.website] } : {}),
  };
}

/** A bill or a resolution in Parliament. */
export function legislationLd(item: { path: string; name: string; kind: string; date?: string | null; officialUrl?: string | null }) {
  return {
    "@context": "https://schema.org",
    "@type": "Legislation",
    name: item.name,
    url: absolute(item.path),
    legislationType: item.kind,
    legislationJurisdiction: "PT",
    inLanguage: "pt-PT",
    ...(item.date ? { legislationDate: item.date } : {}),
    legislationPassedBy: PARLIAMENT,
    ...(item.officialUrl ? { sameAs: [item.officialUrl] } : {}),
  };
}
