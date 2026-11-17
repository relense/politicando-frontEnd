"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { ADMIN_ROLES, getTeam, inviteMember, ROLE_LABELS, updateMember, type AdminRole, type TeamMember } from "@/lib/api/admin";
import { formatDateTime } from "@/lib/format";
import { useMe } from "./AdminShell";
import { buttonClass, ConfirmButton, ErrorNote, inputClass, useExpiry } from "./ui";

const ROLE_HINTS: Record<AdminRole, string> = {
  author: "escreve os seus artigos do blog",
  moderator: "modera comentários, fórum, denúncias e feedback",
  admin: "tudo, e gere a equipa",
};

/** The team (admins only): invite, change roles, switch off. */
export function Team() {
  const me = useMe();
  const client = useQueryClient();
  const expiry = useExpiry();
  const team = useQuery({ queryKey: ["admin-team"], queryFn: getTeam });
  const update = useMutation({
    mutationFn: ({ id, input }: { id: number; input: { role?: AdminRole; disabled?: boolean } }) => updateMember(id, input),
    onSuccess: () => client.invalidateQueries({ queryKey: ["admin-team"] }),
    onError: expiry,
  });

  return (
    <section aria-labelledby="equipa">
      <h1 id="equipa" className="mb-1 text-2xl font-bold">
        Equipa
      </h1>
      <p className="mb-4 text-sm text-muted">Quem pode entrar na moderação. Desativar alguém termina todas as suas sessões.</p>
      <ErrorNote error={update.error ?? team.error} />
      {team.isPending ? (
        <p className="text-muted">A carregar…</p>
      ) : (
        <ul aria-label="Equipa" className="mb-8 divide-y divide-line rounded-2xl border border-line">
          {team.data?.map((member) => (
            <MemberRow
              key={member.id}
              member={member}
              self={member.id === me.id}
              busy={update.isPending && update.variables?.id === member.id}
              onChange={(input) => update.mutate({ id: member.id, input })}
            />
          ))}
        </ul>
      )}
      <InviteForm />
    </section>
  );
}

function MemberRow({
  member,
  self,
  busy,
  onChange,
}: {
  member: TeamMember;
  self: boolean;
  busy: boolean;
  onChange: (input: { role?: AdminRole; disabled?: boolean }) => void;
}) {
  return (
    <li className={`flex flex-wrap items-center gap-3 p-3 ${member.disabled ? "opacity-60" : ""}`}>
      <span className="min-w-0 flex-1">
        <b className="block">
          {member.name} {self && <span className="font-mono text-xs font-normal text-muted">(tu)</span>}
          {member.disabled && <span className="ml-1 rounded-full border border-line px-2 py-0.5 font-mono text-[11px]">Desativado</span>}
        </b>
        <span className="block break-all font-mono text-xs text-muted">{member.email}</span>
        <span className="block font-mono text-[11px] text-muted">
          {member.lastLoginAt ? `Última entrada ${formatDateTime(member.lastLoginAt)}` : "Ainda não entrou"}
        </span>
      </span>
      <label>
        <span className="sr-only">Função de {member.name}</span>
        <select
          value={member.role}
          disabled={busy || self}
          onChange={(event) => onChange({ role: event.target.value as AdminRole })}
          className={`${inputClass} w-auto`}
        >
          {ADMIN_ROLES.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABELS[role]}
            </option>
          ))}
        </select>
      </label>
      {!self &&
        (member.disabled ? (
          <button type="button" disabled={busy} onClick={() => onChange({ disabled: false })} className={buttonClass()}>
            Reativar
          </button>
        ) : (
          <ConfirmButton
            label="Desativar"
            confirmLabel={`Desativar ${member.name}`}
            disabled={busy}
            onConfirm={() => onChange({ disabled: true })}
          />
        ))}
    </li>
  );
}

function InviteForm() {
  const client = useQueryClient();
  const expiry = useExpiry();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<AdminRole>("moderator");
  const [password, setPassword] = useState("");
  const invite = useMutation({
    mutationFn: () => inviteMember({ email: email.trim(), name: name.trim(), role, password }),
    onSuccess: () => {
      setEmail("");
      setName("");
      setPassword("");
      client.invalidateQueries({ queryKey: ["admin-team"] });
    },
    onError: expiry,
  });
  const ready = email.trim() && name.trim() && password.length >= 12;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (ready) invite.mutate();
  }

  return (
    <form onSubmit={submit} className="flex max-w-xl flex-col gap-3 rounded-2xl border border-line p-4">
      <h2 className="font-bold">Convidar alguém</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="font-mono text-xs font-bold">Nome</span>
          <input value={name} maxLength={100} onChange={(event) => setName(event.target.value)} className={inputClass} required />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-xs font-bold">Email</span>
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className={inputClass} required />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-xs font-bold">Função</span>
          <select value={role} onChange={(event) => setRole(event.target.value as AdminRole)} className={inputClass}>
            {ADMIN_ROLES.map((value) => (
              <option key={value} value={value}>
                {ROLE_LABELS[value]}: {ROLE_HINTS[value]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-xs font-bold">Primeira palavra-passe</span>
          <input
            type="text"
            autoComplete="off"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={inputClass}
            required
          />
          <span className="text-xs text-muted">Pelo menos 12 caracteres. Entrega-a em segurança e pede para a mudar.</span>
        </label>
      </div>
      <ErrorNote error={invite.error} />
      {invite.isSuccess && (
        <p role="status" className="text-sm text-[var(--stage-approved)]">
          Convite criado. Já pode entrar com essa palavra-passe.
        </p>
      )}
      <div>
        <button type="submit" disabled={invite.isPending || !ready} className={buttonClass("ink")}>
          Convidar
        </button>
      </div>
    </form>
  );
}
