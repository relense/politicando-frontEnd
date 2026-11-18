export const SITE_NAME = "Politicando";
/** What the site is, for search results and shares: Portugal's politics, said plainly (about 150 characters at most). */
export const SITE_DESCRIPTION =
  "Política portuguesa num só lugar: as notícias de todos os partidos, o Parlamento, o Governo, as eleições e as leis, explicados com clareza.";
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
/** Where readers write: corrections, contact; people named in the record have a right of reply. An empty variable counts as unset. */
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || "info@politicando.pt";
/** Who answers for the site and its data (the controller under the GDPR). Set it before going live. */
export const SITE_OWNER = process.env.NEXT_PUBLIC_SITE_OWNER ?? null;
/** For privacy requests: access, correction, deletion. Falls back to the contact address. */
export const PRIVACY_EMAIL = process.env.NEXT_PUBLIC_PRIVACY_EMAIL || CONTACT_EMAIL;
/** When the privacy, cookies and terms pages last changed. */
export const LEGAL_UPDATED = "2026-11-16";
