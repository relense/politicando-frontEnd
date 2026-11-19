import { ApiError } from "./api/client";

/*
 * Names that pass for the team, refused as anonymous nicknames and comment names (backend src/accounts/reserved.ts,
 * docs/forums-api.md). Checked here too so the reader hears it before posting; the API has the last word.
 */

/** Team words a signature can't contain ("Moderação", "A Equipa", "Admin1"; accents, case and spacing ignored). */
const TEAM_WORDS = ["politicando", "admin", "moderador", "moderacao", "moderator", "redacao", "equipa", "staff", "suporte", "support"];
/** Too short to look for inside other names ("Modesto"): only on their own. */
const TEAM_EXACT = ["mod", "mods", "sistema", "system", "root"];

export const looksLikeTeam = (name: string) => {
  const plain = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  return TEAM_WORDS.some((word) => plain.includes(word)) || TEAM_EXACT.includes(plain.replace(/\d+$/, ""));
};

export const RESERVED_NAME_MESSAGE = "Esse nome está reservado à equipa do Politicando. Escolhe outro ou deixa em branco.";

/** The API refuses a team name with a plain 400 validation error; only its message tells it apart. */
export const reservedNameMessage = (error: unknown): string | null =>
  error instanceof ApiError && error.status === 400 && /the team's/i.test(error.message) ? RESERVED_NAME_MESSAGE : null;
