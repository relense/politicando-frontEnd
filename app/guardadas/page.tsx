import type { Metadata } from "next";
import { SavedLists } from "@/components/account/SavedLists";

export const metadata: Metadata = {
  title: "Notícias guardadas",
  description: "As notícias, artigos, comentários e discussões que guardaste na tua conta.",
  alternates: { canonical: "/guardadas" },
  // Each reader's own list: nothing for search engines.
  robots: { index: false, follow: true },
};

export default function SavedPage() {
  return (
    <div data-wide className="max-w-3xl">
      <header className="mb-6">
        <p className="mb-2 font-mono text-xs uppercase tracking-widest text-muted">As tuas notícias</p>
        <h1 className="text-3xl font-bold leading-tight sm:text-4xl">
          Notícias{" "}
          <span className="bg-[linear-gradient(transparent_55%,var(--marker)_55%,var(--marker)_92%,transparent_92%)] px-1">guardadas</span>
        </h1>
        <p className="mt-2 max-w-2xl leading-relaxed text-muted">
          As notícias que guardaste com o botão ⋯ ou «Guardar», e os artigos do blog, comentários e discussões. Ficam na tua conta, em todos
          os teus dispositivos.
        </p>
      </header>
      <SavedLists />
    </div>
  );
}
