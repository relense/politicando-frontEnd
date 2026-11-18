/** "Quem é …": a few plain sentences from the person's public records, the answer to the question people search for. */
export function WhoIs({ name, sentences }: { name: string; sentences: string[] }) {
  if (sentences.length === 0) return null;
  return (
    <section aria-labelledby="quem-e" className="mb-8">
      <h2 id="quem-e" className="mb-2 font-mono text-[11px] font-bold uppercase tracking-widest text-muted">
        Quem é {name}
      </h2>
      <p className="max-w-3xl text-[17px] leading-relaxed">{sentences.join(" ")}</p>
    </section>
  );
}
