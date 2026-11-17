import type { Metadata } from "next";
import { SavedArticles } from "@/components/SavedArticles";

export const metadata: Metadata = {
  title: "Notícias guardadas",
  description: "As notícias que guardaste neste navegador.",
  alternates: { canonical: "/guardadas" },
  // Each reader's own list, kept in their browser: nothing for search engines.
  robots: { index: false, follow: true },
};

export default function SavedPage() {
  return (
    <div data-wide className="max-w-3xl">
      <header className="mb-6">
        <p className="mb-2 font-mono text-xs uppercase tracking-widest text-muted">Só neste navegador · sem conta</p>
        <h1 className="text-3xl font-bold leading-tight sm:text-4xl">
          Notícias{" "}
          <span className="bg-[linear-gradient(transparent_55%,var(--marker)_55%,var(--marker)_92%,transparent_92%)] px-1">guardadas</span>
        </h1>
        <p className="mt-2 max-w-2xl leading-relaxed text-muted">
          As que guardaste com o botão ⋯ de cada notícia. Ficam neste navegador: noutro telemóvel ou computador, a lista começa vazia.
        </p>
      </header>
      <SavedArticles />
    </div>
  );
}
