/*
 * Reading is free; taking part needs a reader account: commenting, the forum, every vote and mark, reports, saving,
 * following and predicting. (The backend's LOGIN_REQUIRED should say "comments,forum,votes,reports".) A reader without
 * an account is asked before taking part, never after writing and pressing "Publicar": a small note next to the button
 * they pressed (a sheet from the bottom on phones), or, in the comment box, a bar in place of "Publicar". The API still
 * has the last word: a `login_required` answer opens the same note.
 */

export const PARTICIPATIONS = ["comments", "forum", "votes", "reports"] as const;
export type Participation = (typeof PARTICIPATIONS)[number];

// Every kind, always: kept as a function so the callers say which kind of taking part they are.
export const needsAccount = (what: Participation) => PARTICIPATIONS.includes(what);

/** The buttons that ask for an account, and what each one needs. */
export type AskKind = "importa" | "post" | "vote" | "like" | "idea" | "report" | "forum" | "follow" | "save" | "predict" | "any";

/** What each button is, for the API's words; all of them need an account. */
export const ASK_NEEDS: Record<Exclude<AskKind, "any">, Participation | "account"> = {
  importa: "votes",
  post: "votes",
  vote: "votes",
  like: "votes",
  idea: "votes",
  report: "reports",
  forum: "forum",
  follow: "account",
  save: "account",
  predict: "account",
};

/** One sentence about that action, and what happens after logging in. */
export const ASK_COPY: Record<AskKind, { label: string; title: string; text: string; after?: string }> = {
  importa: {
    label: "Importa",
    title: "Diz-nos que esta notícia importa",
    text: "Cada “Importa” conta uma vez por pessoa. É isso que mantém o “Hoje em 5” honesto, por isso pedimos conta.",
    after: "Depois de entrares, marcamos “Importa” por ti.",
  },
  post: {
    label: "Importa",
    title: "Diz-nos que este artigo importa",
    text: "Cada “Importa” conta uma vez por pessoa, para que os artigos mais úteis cheguem a mais gente. Por isso pedimos conta.",
    after: "Depois de entrares, marcamos “Importa” por ti.",
  },
  vote: {
    label: "Votar",
    title: "Vota nesta notícia",
    text: "Cada voto conta uma vez por pessoa. Assim ninguém vota duas vezes e a pontuação fica honesta.",
    after: "Depois de entrares, contamos o teu voto.",
  },
  like: {
    label: "Gostar",
    title: "Gostas deste comentário?",
    text: "Cada gosto conta uma vez por pessoa, por isso pedimos conta.",
    after: "Depois de entrares, contamos o teu gosto.",
  },
  idea: {
    label: "Votar",
    title: "Apoia esta ideia",
    text: "Cada pessoa apoia uma ideia uma vez. É assim que sabemos o que fazer primeiro.",
    after: "Depois de entrares, contamos o teu voto.",
  },
  report: {
    label: "Denunciar",
    title: "Ajuda-nos a moderar",
    text: "Com conta, as denúncias vêm de pessoas reais e chegam mais depressa a quem modera.",
    after: "Depois de entrares, voltas aqui para a fazer.",
  },
  forum: {
    label: "Fórum",
    title: "Escreve no fórum",
    text: "Responder e abrir discussões pede uma conta. Ler continua livre.",
    after: "Depois de entrares, voltas a esta página.",
  },
  follow: {
    label: "Seguir",
    title: "Segue o que te interessa",
    text: "Avisamos-te na tua conta quando há novidades: novas respostas numa discussão, ou mais jornais a contar a mesma história.",
    after: "Depois de entrares, voltas a esta página para seguir.",
  },
  save: {
    label: "Guardar",
    title: "Guarda para ler depois",
    text: "Notícias, artigos, comentários e discussões guardados ficam na tua conta, em todos os teus dispositivos.",
    after: "Depois de entrares, voltas a esta página para guardar.",
  },
  predict: {
    label: "Passa ou chumba?",
    title: "Entra para prever",
    text: "Diz se achas que passa na próxima votação e vê depois como votaram os outros. As tuas previsões são só tuas.",
    after: "Depois de entrares, voltas aqui para escolher.",
  },
  any: {
    label: "Conta",
    title: "Entra para participar",
    text: "Comentar, votar, marcar “Importa”, guardar e denunciar pedem uma conta. Ler continua livre.",
  },
};
