import type { ArticleParty } from "@/lib/types";

/** Logos by party slug. Parties missing here get a neutral badge, never another party's logo. */
const PARTY_LOGOS: Record<string, string> = {
  ps: "ps_logo.png",
  psd: "psd_logo.png",
  be: "be_logo.png",
  "cds-pp": "cds_logo.png",
  pcp: "pcp_logo.png",
  pev: "pev_logo.png",
  pan: "pan_logo.png",
  jpp: "jpp_logo.png",
  ppm: "ppm_logo.png",
  ptp: "ptp_logo.png",
  mpt: "mpt_logo.png",
  livre: "l_logo.png",
  nc: "nc_logo.png",
  "pctp-mrpp": "pctp_logo.png",
  mas: "mas_logo.png",
  il: "il_logo.png",
};

/** Old URLs that match neither the current slug nor the current acronym. */
const LEGACY_SLUGS: Record<string, string> = { pctp: "pctp-mrpp" };

export function getPartyLogo(slug: string): string | undefined {
  return PARTY_LOGOS[slug];
}

export function partyPath(slug: string): string {
  return `/partido/${encodeURIComponent(slug)}`;
}

/** Accepts the slug, plus the lowercase acronyms that the old site used in its URLs. */
export function findPartyByParam<T extends ArticleParty>(parties: T[], param: string): T | undefined {
  let decoded: string;
  try {
    decoded = decodeURIComponent(param).toLowerCase();
  } catch {
    return undefined;
  }
  const slug = LEGACY_SLUGS[decoded] ?? decoded;
  return parties.find((party) => party.slug === slug) ?? parties.find((party) => party.acronym.toLowerCase() === decoded);
}
