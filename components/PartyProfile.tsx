import type { PartyProfile as Profile } from "@/lib/partyProfiles";

const SOURCE_LABEL: Record<Profile["sourceKind"], string> = {
  official: "apresentação do próprio partido",
  wikipedia: "Wikipédia",
  press: "notícia",
};

/** A short, neutral "what this party stands for", with its source so readers can check it. */
export function PartyProfile({ profile }: { profile: Profile }) {
  return (
    <section aria-labelledby="sobre-o-partido" className="mt-5">
      <h2 id="sobre-o-partido" className="sr-only">
        Sobre o partido
      </h2>
      <p className="leading-relaxed">{profile.summary}</p>
      <p className="mt-2 font-mono text-xs text-muted">
        {profile.founded && <>Fundado em {profile.founded} · </>}
        Fonte:{" "}
        <a href={profile.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-link underline">
          {SOURCE_LABEL[profile.sourceKind]}
          <span className="sr-only"> (abre num novo separador)</span>
        </a>
      </p>
    </section>
  );
}
