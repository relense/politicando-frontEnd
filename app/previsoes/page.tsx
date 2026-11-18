import type { Metadata } from "next";
import { PredictionsPage } from "@/components/Predictions";
import { cached } from "@/lib/api/client";
import { getOpenPredictions } from "@/lib/api/engagement";

export const metadata: Metadata = {
  title: "Passa ou chumba? Previsões das votações no Parlamento",
  description:
    "Antes de uma votação no Parlamento, diz se achas que a proposta passa. O que os outros leitores previram só aparece depois de escolheres. O teu registo é só teu.",
  alternates: { canonical: "/previsoes" },
};

/** "Passa ou chumba?": the open votes, the same for everyone (the reader's own picks come in the browser). */
export default async function PredictionsRoute() {
  const open = await getOpenPredictions(10, cached).catch(() => []);
  return (
    <div data-wide>
      <header className="mb-6 max-w-2xl">
        <p className="font-mono text-xs uppercase tracking-widest text-muted">Parlamento</p>
        <h1 className="mt-2 text-3xl font-bold leading-tight sm:text-4xl">Passa ou chumba?</h1>
        <p className="mt-2 font-mono text-sm leading-relaxed text-muted">
          Antes de uma votação no Parlamento, diz se achas que a proposta passa. O que os outros leitores previram só aparece depois de
          escolheres, para não influenciar ninguém. O teu registo de acertos é só teu.
        </p>
      </header>
      <PredictionsPage initial={open} />
    </div>
  );
}
