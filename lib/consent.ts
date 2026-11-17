/**
 * The reader's choice about players from other sites (Spotify, YouTube…), which set their own cookies when they load.
 * Kept in this browser only; storage can be blocked, and then the player simply asks each time.
 */
export const EMBEDS_KEY = "embeds";
const EVENT = "politicando:embeds";

export function embedsAllowed(): boolean {
  try {
    return window.localStorage.getItem(EMBEDS_KEY) === "yes";
  } catch {
    return false;
  }
}

export function setEmbedsAllowed(allowed: boolean) {
  try {
    if (allowed) window.localStorage.setItem(EMBEDS_KEY, "yes");
    else window.localStorage.removeItem(EMBEDS_KEY);
  } catch {
    // Blocked storage: the choice lasts for this page only.
  }
  window.dispatchEvent(new Event(EVENT));
}

export function subscribeEmbeds(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export const PROVIDER_NAMES: Record<string, string> = {
  spotify: "Spotify",
  youtube: "YouTube",
  vimeo: "Vimeo",
  soundcloud: "SoundCloud",
  apple: "Apple Podcasts",
  apple_podcasts: "Apple Podcasts",
  applepodcasts: "Apple Podcasts",
};

export const providerName = (provider: string) => PROVIDER_NAMES[provider.toLowerCase()] ?? provider;

/**
 * The cookie banner's answer (only asked when FEATURES.cookieBanner is on): "all" lets Google's reCAPTCHA and the
 * players load without asking; "essential" keeps them behind a button each time; null is not answered yet.
 */
export type CookieConsent = "all" | "essential" | null;
export const CONSENT_KEY = "cookie-consent";
const CONSENT_EVENT = "politicando:consent";

export function cookieConsent(): CookieConsent {
  try {
    const value = window.localStorage.getItem(CONSENT_KEY);
    return value === "all" || value === "essential" ? value : null;
  } catch {
    return null;
  }
}

export function setCookieConsent(value: Exclude<CookieConsent, null>) {
  try {
    window.localStorage.setItem(CONSENT_KEY, value);
  } catch {
    // Blocked storage: the banner asks again next time.
  }
  setEmbedsAllowed(value === "all");
  window.dispatchEvent(new Event(CONSENT_EVENT));
}

export function subscribeConsent(onChange: () => void) {
  window.addEventListener(CONSENT_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CONSENT_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}
