"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useId, useState, type FormEvent, type ReactNode } from "react";
import { adminErrorMessage, canModerate, getMe, login, logout, ROLE_LABELS, type Me } from "@/lib/api/admin";

const MeContext = createContext<Me | null>(null);

/** The signed-in member of the team; only inside the admin shell. */
export function useMe(): Me {
  const me = useContext(MeContext);
  if (!me) throw new Error("useMe outside the admin shell");
  return me;
}

export const ME_KEY = ["admin-me"];

const SECTIONS: { href: string; label: string; moderator?: boolean; admin?: boolean }[] = [
  { href: "/admin", label: "Denúncias", moderator: true },
  { href: "/admin/comentarios", label: "Comentários", moderator: true },
  { href: "/admin/forum", label: "Fórum", moderator: true },
  { href: "/admin/ideias", label: "Ideias", moderator: true },
  { href: "/admin/feedback", label: "Feedback", moderator: true },
  { href: "/admin/artigos", label: "Artigos" },
  { href: "/admin/utilizadores", label: "Utilizadores", admin: true },
  { href: "/admin/equipa", label: "Equipa", admin: true },
  { href: "/admin/conta", label: "A minha conta" },
];

/** A section's page, or one inside it (/admin/artigos/12). The reports queue is /admin itself, so only exactly. */
const inSection = (href: string, pathname: string) => pathname === href || (href !== "/admin" && pathname.startsWith(`${href}/`));

/** The moderation area: signs in when needed, then the sections the member's role allows. */
export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const client = useQueryClient();
  const me = useQuery({ queryKey: ME_KEY, queryFn: getMe, retry: false, staleTime: 60_000 });
  const signOut = useMutation({
    mutationFn: logout,
    onSettled: () => client.setQueryData(ME_KEY, null),
  });

  if (me.isPending) return <p className="text-muted">A verificar a sessão…</p>;
  if (me.isError)
    return (
      <p role="alert" className="text-danger">
        Não foi possível falar com a API. Tenta recarregar a página.
      </p>
    );
  if (!me.data) return <LoginForm />;

  const member = me.data;
  const sections = SECTIONS.filter((section) => (section.admin ? member.role === "admin" : section.moderator ? canModerate(member) : true));
  const allowed = sections.some((section) => inSection(section.href, pathname));

  return (
    <MeContext.Provider value={member}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b-2 border-ink pb-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-muted">Moderação</p>
          <p className="font-bold">
            {member.name} <span className="font-mono text-xs font-normal text-muted">· {ROLE_LABELS[member.role]}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => signOut.mutate()}
          className="min-h-9 rounded-full border border-line px-4 font-mono text-xs font-bold hover:bg-surface"
        >
          Sair
        </button>
      </div>
      <nav aria-label="Secções da moderação" className="mb-6">
        <ul className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
          {sections.map((section) => {
            const active = inSection(section.href, pathname);
            return (
              <li key={section.href} className="shrink-0">
                <Link
                  href={section.href}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex min-h-9 items-center rounded-full border px-4 font-mono text-xs font-bold ${
                    active ? "border-ink bg-ink text-paper" : "border-line hover:bg-surface"
                  }`}
                >
                  {section.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      {allowed ? (
        children
      ) : (
        <p className="rounded-2xl border border-dashed border-line p-6 text-muted">
          A tua função ({ROLE_LABELS[member.role]}) não dá acesso a esta secção.{" "}
          <Link href={sections[0]!.href} className="font-bold text-ink underline">
            Ir para {sections[0]!.label}
          </Link>
        </p>
      )}
    </MeContext.Provider>
  );
}

function LoginForm() {
  const id = useId();
  const client = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const signIn = useMutation({
    mutationFn: () => login(email.trim(), password),
    onSuccess: () => client.invalidateQueries({ queryKey: ME_KEY }),
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!email.trim() || !password) return;
    signIn.mutate();
  }

  return (
    <form
      onSubmit={submit}
      aria-labelledby={`${id}-title`}
      className="mx-auto mt-8 flex max-w-sm flex-col gap-4 rounded-2xl border border-line p-6"
    >
      <div>
        <h1 id={`${id}-title`} className="text-2xl font-bold">
          Moderação
        </h1>
        <p className="mt-1 text-sm text-muted">Só para a equipa do Politicando. Quem lê o site não precisa de conta.</p>
      </div>
      <label className="flex flex-col gap-1">
        <span className="font-mono text-xs font-bold">Email</span>
        <input
          type="email"
          autoComplete="username"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="rounded-lg border border-line bg-paper px-3 py-2"
          required
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-mono text-xs font-bold">Palavra-passe</span>
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="rounded-lg border border-line bg-paper px-3 py-2"
          required
        />
      </label>
      {signIn.isError && (
        <p role="alert" className="text-sm text-danger">
          {adminErrorMessage(signIn.error)}
        </p>
      )}
      <button
        type="submit"
        disabled={signIn.isPending}
        className="min-h-10 rounded-full bg-ink px-5 font-mono text-sm font-bold text-paper hover:opacity-90 disabled:opacity-60"
      >
        {signIn.isPending ? "A entrar…" : "Entrar"}
      </button>
    </form>
  );
}
