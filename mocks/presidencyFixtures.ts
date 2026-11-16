import { http, HttpResponse } from "msw";
import type { ApiPresidencyInput } from "@/lib/api/presidency";
import { articles } from "./fixtures";
import { initiatives } from "./parliamentFixtures";

const API = "*/api/v2";

const withPresidency = (status: string) => initiatives.filter((item) => item.presidency?.status === status);

/** A fictional President, matching the history fixtures, with no photo (the page shows initials). */
export const presidency: ApiPresidencyInput = {
  president: {
    id: "teresa-albuquerque",
    name: "Teresa Albuquerque",
    fullName: "Teresa Maria Albuquerque Sampaio",
    termStart: "2026-03-09",
    bio: [
      "Teresa Albuquerque nasceu em 1961, numa vila do interior, e formou-se em Direito.",
      "Foi professora universitária e deputada durante duas legislaturas.",
      "Presidiu a uma comissão parlamentar dedicada aos assuntos constitucionais.",
      "Foi eleita Presidente da República na segunda volta das eleições presidenciais.",
    ],
    photoUrl: null,
    url: "https://www.presidencia.pt/presidente-da-republica/o-presidente/biografia/",
    birthDate: "1961-04-02",
    birthPlace: "Vila Velha de Ródão",
    residence: "Coimbra",
  },
  legislation: {
    promulgated: 42,
    vetoed: 3,
    allTime: { since: "2025-07-14", promulgated: 71, vetoed: 5, vetoedUnconstitutional: 2, pending: 1 },
    pending: withPresidency("pending").length,
    latestVetoes: withPresidency("vetoed").slice(0, 3),
    latestPromulgated: withPresidency("promulgated").slice(0, 5),
    pendingNow: withPresidency("pending"),
  },
  articles: articles.slice(0, 4),
  former: [{ id: "jorge-vilalobos", name: "Jorge Vilalobos", termStart: "2016-03-09", termEnd: "2026-03-09" }],
};

const TOPICS = [
  { slug: "habitacao", label: "Habitação e urbanismo" },
  { slug: "saude", label: "Saúde" },
  { slug: "educacao", label: "Educação" },
  { slug: "impostos", label: "Impostos" },
  { slug: "trabalho", label: "Trabalho e salários" },
  { slug: "pensoes", label: "Pensões e apoios sociais" },
  { slug: "seguranca", label: "Segurança e proteção civil" },
  { slug: "transportes", label: "Transportes e mobilidade" },
  { slug: "transparencia", label: "Transparência e corrupção" },
];

export const presidencyHandlers = [
  http.get(`${API}/president`, () => HttpResponse.json(presidency)),
  http.get(`${API}/initiatives/topics`, () =>
    HttpResponse.json({
      items: TOPICS.map((topic) => ({
        ...topic,
        count: initiatives.filter((item) => item.topics?.some((tag) => tag.slug === topic.slug)).length,
      })),
      untagged: initiatives.filter((item) => !item.topics?.length).length,
    }),
  ),
];
