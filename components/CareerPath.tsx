import Link from "next/link";
import type { PathStep, PersonKind, PersonPath, StepKind } from "@/lib/api/people";
import { STEP_LABELS, stepHeading } from "@/lib/records";

/** One mid-tone per kind of step, readable on light and dark paper; the kind is also written out, never colour only. */
export const STEP_COLORS: Record<StepKind, string> = {
  parliament: "#2f7d5b",
  government: "#3567c4",
  presidency: "#9a5bc0",
  party: "#c4733a",
  local: "#b3912f",
  election: "#7a7f8a",
  other: "#7a7f8a",
};

const external = <span className="sr-only"> (abre num novo separador)</span>;

/** "Percurso": the dated steps of a career, ongoing first, as a vertical timeline. */
export function CareerTimeline({ steps, limit }: { steps: PathStep[]; limit?: number }) {
  const shown = limit ? steps.slice(0, limit) : steps;
  return (
    <ol className="relative ml-1.5 space-y-4 border-l-2 border-line pl-5">
      {shown.map((step, index) => {
        const { title, detail, when } = stepHeading(step);
        return (
          <li key={`${step.title}-${step.from}-${index}`} className="relative">
            <span
              aria-hidden="true"
              className="absolute -left-[1.72rem] top-1.5 size-3 rounded-full ring-4 ring-paper"
              style={{ backgroundColor: STEP_COLORS[step.kind] }}
            />
            <p className="flex flex-wrap items-center gap-x-2 font-mono text-xs text-muted">
              <span className="font-bold uppercase tracking-wide">{STEP_LABELS[step.kind]}</span>
              {when && <span>· {when}</span>}
              {step.current && <span className="rounded-full bg-ink px-2 py-0.5 text-[10px] font-bold uppercase text-paper">atual</span>}
            </p>
            <p className="font-bold leading-snug">
              {step.source ? (
                <a href={step.source} target="_blank" rel="noopener noreferrer" className="hover:underline">
                  {title}
                  {external}
                </a>
              ) : (
                title
              )}
            </p>
            {detail && <p className="text-sm text-muted">{detail}</p>}
          </li>
        );
      })}
    </ol>
  );
}

function RoleList({ title, roles }: { title: string; roles: PathStep[] }) {
  if (roles.length === 0) return null;
  return (
    <div>
      <h3 className="mb-2 font-mono text-xs font-bold uppercase tracking-widest text-muted">{title}</h3>
      <ul className="space-y-1.5 text-sm">
        {roles.map((role) => (
          <li key={role.title} className="flex gap-2">
            <span aria-hidden="true" className="mt-1.5 size-2 shrink-0 rounded-full" style={{ backgroundColor: STEP_COLORS[role.kind] }} />
            <span>
              {role.title}
              <span className="text-muted"> · {STEP_LABELS[role.kind]}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Links to the same person's other pages: as deputy, as Government member, as President. */
export function PersonLinks({ path, here }: { path: PersonPath; here: PersonKind }) {
  const { deputyId, governmentMemberId, presidentId } = path.person.links;
  const links = [
    deputyId !== null && here !== "deputy" && { href: `/deputados/${deputyId}`, label: "Ficha de deputado" },
    governmentMemberId !== null && here !== "government" && { href: `/governo/${governmentMemberId}`, label: "No Governo" },
    presidentId !== null && here !== "president" && { href: "/presidente", label: "Presidente da República" },
  ].filter((link): link is { href: string; label: string } => Boolean(link));
  if (links.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-sm">
      {links.map((link) => (
        <li key={link.href}>
          <Link href={link.href} className="text-link underline">
            {link.label} →
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** The whole career: the timeline, the roles held now and the ones from their biography. */
export function CareerPath({ path, here }: { path: PersonPath; here: PersonKind }) {
  const empty = path.path.length === 0 && path.currentRoles.length === 0 && path.otherRoles.length === 0;
  if (empty) return null;
  return (
    <div className="space-y-6">
      {path.path.length > 0 && <CareerTimeline steps={path.path} />}
      <div className="grid gap-6 sm:grid-cols-2">
        <RoleList title="Cargos atuais" roles={path.currentRoles} />
        <RoleList title="Outros cargos" roles={path.otherRoles} />
      </div>
      <PersonLinks path={path} here={here} />
      <p className="font-mono text-xs text-muted">
        Fontes oficiais: Assembleia da República, portal do Governo e Presidência. As legislaturas mostram os anos da legislatura, não as
        datas exatas do mandato.
      </p>
    </div>
  );
}
