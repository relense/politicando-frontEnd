export const SITE_NAME = "Politicando";
/** The home page's title, at most 60 characters: Google and share cards cut it there. */
export const SITE_TITLE = `${SITE_NAME} | Notícias, Parlamento e eleições em Portugal`;
/** What the site is, for search results and shares: Portugal's politics, said plainly. At most 125 characters: share previews cut there. */
export const SITE_DESCRIPTION =
  "Política portuguesa num só lugar: notícias dos partidos, Parlamento, Governo, eleições e leis, explicados com clareza.";
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
/** Where readers write: corrections, contact; people named in the record have a right of reply. An empty variable counts as unset. */
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || "info@politicando.pt";
/** Who answers for the site and its data (the controller under the GDPR). Set it before going live. */
export const SITE_OWNER = process.env.NEXT_PUBLIC_SITE_OWNER ?? null;
/** For privacy requests: access, correction, deletion. Falls back to the contact address. */
export const PRIVACY_EMAIL = process.env.NEXT_PUBLIC_PRIVACY_EMAIL || CONTACT_EMAIL;
/** When the privacy, cookies and terms pages last changed. */
export const LEGAL_UPDATED = "2026-11-16";

/** Our podcast's show on Spotify: its player always starts on the newest episode, so this never changes. */
export const PODCAST_SHOW_URL = "https://open.spotify.com/show/6qMcWa60jvf3CqsSZtzPtT";

export const X_HANDLE = "@politicando_pt";

/** Our profiles elsewhere: the footer, the side menu, and the structured data that tells Google they are ours. */
export const SOCIAL_PROFILES = [
  { key: "x", name: "X (Twitter)", label: X_HANDLE, url: "https://x.com/politicando_pt" },
  { key: "instagram", name: "Instagram", label: "@politicando.pt", url: "https://www.instagram.com/politicando.pt/" },
  { key: "tiktok", name: "TikTok", label: "@politicandopt", url: "https://www.tiktok.com/@politicandopt" },
  { key: "threads", name: "Threads", label: "@politicando.pt", url: "https://www.threads.com/@politicando.pt" },
  { key: "spotify", name: "Spotify", label: "Podcast", url: PODCAST_SHOW_URL },
] as const;
