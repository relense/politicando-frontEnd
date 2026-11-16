import { http, HttpResponse } from "msw";

const API = "*/api/v2";

/** Fictional corrections and ideas, in the shape of the contract in docs/api-handoff.md. */
const corrections = [
  {
    id: 4,
    status: "fixed",
    date: "2026-11-16",
    area: "Percursos",
    title: "Cargo de Presidente da Assembleia em falta no percurso de Rui Carvalhal",
    url: "/percursos",
  },
  { id: 3, status: "checking", date: "2026-11-15", area: "Contratos", title: "O ano de 2023 mostrava só 2 contratos", url: null },
  {
    id: 2,
    status: "fixed",
    date: "2026-11-14",
    area: "Presidente",
    title: "Decretos vetados apareciam como pendentes",
    url: "/presidente",
  },
  {
    id: 1,
    status: "fixed",
    date: "2026-11-12",
    area: "Eleições",
    title: "A soma dos mandatos das legislativas de 2025 não dava 230",
    url: null,
  },
  { id: 0, status: "rejected", date: "2026-11-10", area: "Governo", title: "Data de posse de uma secretária de Estado", url: null },
];

const ideas = [
  { id: "alertas", title: "Alertas quando um partido que sigo é notícia", votes: 215, status: "in_progress" },
  { id: "comparar", title: "Comparar votações de dois partidos", votes: 168, status: "planned" },
  { id: "leitura", title: "Modo de leitura sem imagens", votes: 47, status: "reviewing" },
];

export const feedbackHandlers = [
  http.get(`${API}/feedback/summary`, () =>
    HttpResponse.json({ stats: { responseDays: 2, correctionsThisMonth: 38 }, corrections: corrections.slice(0, 4), ideas }),
  ),
  http.get(`${API}/corrections`, () => HttpResponse.json({ items: corrections, nextCursor: null })),
  http.post(`${API}/feedback`, async ({ request }) => {
    const form = await request.formData();
    if (!form.get("message") || !form.get("recaptchaToken")) {
      return HttpResponse.json({ error: { code: "validation_failed", message: "message is required" } }, { status: 400 });
    }
    const file = form.get("screenshot");
    if (file instanceof File && file.size > 5 * 1024 * 1024) {
      return HttpResponse.json({ error: { code: "file_too_large", message: "Too large" } }, { status: 413 });
    }
    return HttpResponse.json({ id: 99 }, { status: 201 });
  }),
  http.post(`${API}/ideas/:id/vote`, ({ params }) => {
    const idea = ideas.find((item) => item.id === params.id);
    return idea
      ? HttpResponse.json({ votes: idea.votes + 1 })
      : HttpResponse.json({ error: { code: "not_found", message: "Idea not found" } }, { status: 404 });
  }),
];
