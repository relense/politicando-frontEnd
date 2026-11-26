import Form from "next/form";

/** «Procurar no Politicando»: one search across the site, opening /procurar. `compact`: the square beside the news. */
export function SiteSearchBox({
  defaultValue = "",
  compact = false,
  autoFocus = false,
}: {
  defaultValue?: string;
  compact?: boolean;
  autoFocus?: boolean;
}) {
  const form = (
    <Form action="/procurar" role="search" aria-label="Procurar no Politicando" className="flex gap-2">
      <label className="min-w-0 flex-1">
        <span className="sr-only">Procurar no Politicando</span>
        <input
          type="search"
          name="q"
          defaultValue={defaultValue}
          maxLength={100}
          autoFocus={autoFocus}
          placeholder={compact ? "Pessoas, sítios, leis…" : "Pessoas, sítios, partidos, leis, contratos…"}
          className="h-10 w-full rounded-full border border-line bg-paper px-4 text-sm placeholder:text-muted focus:border-ink focus:outline-none"
        />
      </label>
      <button
        type="submit"
        aria-label="Procurar no Politicando"
        className="h-10 shrink-0 rounded-full border border-ink px-4 font-mono text-xs font-bold hover:bg-surface"
      >
        Procurar
      </button>
    </Form>
  );
  if (!compact) return form;
  return (
    <section aria-labelledby="procurar-no-site" className="rounded-2xl border border-line p-4">
      <h2 id="procurar-no-site" className="mb-2 font-mono text-[11px] font-bold uppercase tracking-widest">
        Procurar no Politicando
      </h2>
      {form}
    </section>
  );
}
