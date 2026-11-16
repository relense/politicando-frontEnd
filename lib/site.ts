export const SITE_NAME = "Politicando";
export const SITE_DESCRIPTION = "As notícias sobre os partidos políticos portugueses, num só lugar. Lê, compara e comenta.";
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
/** Where readers ask for corrections; people named in the record have a right of reply. */
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "correcoes@politicando.pt";
/** Who answers for the site and its data (the controller under the GDPR). Set it before going live. */
export const SITE_OWNER = process.env.NEXT_PUBLIC_SITE_OWNER ?? null;
/** For privacy requests: access, correction, deletion. Falls back to the corrections address. */
export const PRIVACY_EMAIL = process.env.NEXT_PUBLIC_PRIVACY_EMAIL ?? CONTACT_EMAIL;
/** When the privacy, cookies and terms pages last changed. */
export const LEGAL_UPDATED = "2026-11-16";
