"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent, type ReactNode } from "react";
import { forgetAccount, signOut, useReader } from "@/lib/account";
import {
  accountErrorMessage,
  changeReaderPassword,
  deleteReader,
  EXPORT_URL,
  getActivity,
  type Activity,
  type Reader,
} from "@/lib/api/account";
import { ApiError } from "@/lib/api/client";
import { excerpt, formatDateTime, formatLongDate } from "@/lib/format";
import { AccountEmail } from "./AccountEmail";
import { Avatar } from "./AccountMenu";

const BUTTON =
  "inline-flex min-h-10 items-center rounded-full border border-line px-4 font-mono text-xs font-bold hover:bg-surface disabled:opacity-50";
const INPUT = "w-full rounded-xl border border-line bg-paper px-3 py-2.5 font-mono text-sm";

/** Without a session: what the page is for, and the way in (and back here). */
function SignedOut({ title, text, path }: { title: string; text: string; path: string }) {
  const back = `?depois=${encodeURIComponent(path)}`;
  return (
    <div className="max-w-xl rounded-2xl border border-dashed border-line p-6">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="mt-2 text-muted">{text}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={`/entrar${back}`} className={BUTTON}>
          Entrar
        </Link>
        <Link href={`/criar-conta${back}`} className={`${BUTTON} border-ink bg-ink text-paper hover:bg-ink hover:opacity-90`}>
          Criar conta
        </Link>
      </div>
    </div>
  );
}

/** The account's settings: the password, their data, logging out and deleting it all. */
export function AccountSettings() {
  const reader = useReader();
  if (reader === undefined) return <p className="text-muted">A verificar a sessão…</p>;
  if (!reader) return <SignedOut title="Definições da conta" text="Entra para veres e mudares as definições da tua conta." path="/conta" />;
  return <Signed reader={reader} />;
}

/** What the reader wrote with the account: comments, forum threads and replies, newest first. */
export function AccountComments() {
  const reader = useReader();
  if (reader === undefined) return <p className="text-muted">A verificar a sessão…</p>;
  if (!reader)
    return <SignedOut title="Os meus comentários" text="Entra para veres o que escreveste com a tua conta." path="/conta/comentarios" />;
  return (
    <div className="max-w-3xl">
      <header className="mb-6 flex flex-wrap items-center gap-4">
        <Avatar reader={reader} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="font-mono text-xs uppercase tracking-widest text-muted">{reader.username}</p>
          <h1 className="text-2xl font-bold">Os meus comentários</h1>
          <p className="text-sm text-muted">
            Comentários nas notícias, discussões e respostas no fórum, do mais recente para o mais antigo.
          </p>
        </div>
      </header>
      <ActivityList />
    </div>
  );
}

function Signed({ reader }: { reader: Reader }) {
  const client = useQueryClient();
  const router = useRouter();
  return (
    <div className="max-w-3xl space-y-10">
      <header className="flex flex-wrap items-center gap-4">
        <Avatar reader={reader} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="font-mono text-xs uppercase tracking-widest text-muted">Definições da conta</p>
          <h1 className="truncate font-mono text-2xl font-bold">{reader.username}</h1>
          <p className="text-sm text-muted">
            Conta criada a {formatLongDate(reader.createdAt)}. O nome é público: aparece nos teus comentários.
          </p>
        </div>
        <button
          type="button"
          className={BUTTON}
          onClick={async () => {
            await signOut(client);
            router.push("/");
          }}
        >
          Terminar sessão
        </button>
      </header>

      <AccountEmail reader={reader} />

      <Section id="palavra-passe" title="Mudar a palavra-passe">
        <PasswordForm />
      </Section>

      <Section id="dados" title="Os teus dados">
        <p className="text-sm text-muted">
          Guardamos o teu nome público, a palavra-passe cifrada (nunca a vemos), o email se o juntaste (só tu o vês), as notícias que
          guardaste ou escondeste, as histórias que leste, os teus votos e o que escreveste. Podes descarregar tudo num ficheiro.
        </p>
        <a href={EXPORT_URL} download="politicando-os-meus-dados.json" className={`${BUTTON} mt-3`}>
          Descarregar os meus dados (JSON)
        </a>
      </Section>

      <Section id="apagar" title="Apagar a conta">
        <DeleteForm />
      </Section>
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-titulo`} className="scroll-mt-20 border-t border-line pt-6">
      <h2 id={`${id}-titulo`} className="mb-3 text-xl font-bold">
        {title}
      </h2>
      {children}
    </section>
  );
}

function ActivityList() {
  const activity = useQuery({ queryKey: ["reader-activity"], queryFn: getActivity, staleTime: 30_000 });
  if (activity.isPending) return <p className="text-muted">A carregar…</p>;
  if (activity.isError) return <p className="text-danger">Não foi possível carregar. Tenta recarregar a página.</p>;
  const items = itemsOf(activity.data);
  if (items.length === 0)
    return (
      <p className="rounded-2xl border border-dashed border-line p-6 text-center text-muted">Ainda não escreveste nada com esta conta.</p>
    );
  return (
    <ul aria-label="Os meus comentários" className="divide-y divide-line rounded-2xl border border-line">
      {items.map((item) => (
        <li key={item.key} className="p-3">
          <p className="font-mono text-[11px] text-muted">
            {item.kind} · {formatDateTime(item.createdAt)}
          </p>
          {item.href ? (
            <Link href={item.href} className="mt-1 block hover:underline">
              {item.text}
            </Link>
          ) : (
            <p className="mt-1">{item.text}</p>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Comments, threads and replies in one list, newest first, each linked where the page is known. */
export function itemsOf(activity: Activity) {
  return [
    ...activity.comments.map((comment) => ({
      key: `c${comment.id}`,
      kind: "Comentário",
      text: excerpt(comment.body, 200),
      createdAt: comment.createdAt,
      href: comment.articleId ? `/article/${comment.articleId}#comentarios` : null,
    })),
    ...activity.threads.map((thread) => ({
      key: `t${thread.id}`,
      kind: "Discussão no fórum",
      text: thread.title,
      createdAt: thread.createdAt,
      href: `/forum/${encodeURIComponent(thread.board)}/${thread.id}`,
    })),
    ...activity.posts.map((post) => ({
      key: `p${post.id}`,
      kind: "Resposta no fórum",
      text: excerpt(post.body, 200),
      createdAt: post.createdAt,
      href: null,
    })),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function PasswordForm() {
  const id = useId();
  const client = useQueryClient();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const change = useMutation({
    mutationFn: () => changeReaderPassword(current, next),
    onSuccess: () => {
      setCurrent("");
      setNext("");
      setAgain("");
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === "unauthenticated") forgetAccount(client);
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    change.reset();
    if (next.length < 8) return setProblem("A nova palavra-passe precisa de pelo menos 8 caracteres.");
    if (next !== again) return setProblem("As duas novas palavras-passe não são iguais.");
    setProblem(null);
    change.mutate();
  }

  const wrongCurrent = change.error instanceof ApiError && change.error.code === "invalid_credentials";
  return (
    <form onSubmit={submit} noValidate className="grid max-w-md gap-3">
      <PasswordField
        id={`${id}-current`}
        label="Palavra-passe atual"
        value={current}
        onChange={setCurrent}
        autoComplete="current-password"
      />
      <PasswordField id={`${id}-next`} label="Nova palavra-passe" value={next} onChange={setNext} autoComplete="new-password" />
      <PasswordField id={`${id}-again`} label="Repete a nova palavra-passe" value={again} onChange={setAgain} autoComplete="new-password" />
      {(problem || change.error) && (
        <p role="alert" className="text-sm text-danger">
          {problem ?? (wrongCurrent ? "A palavra-passe atual não está certa." : accountErrorMessage(change.error))}
        </p>
      )}
      {change.isSuccess && (
        <p role="status" className="text-sm">
          Palavra-passe mudada. As sessões noutros dispositivos foram terminadas.
        </p>
      )}
      <div>
        <button type="submit" disabled={change.isPending || !current || !next} className={BUTTON}>
          Mudar a palavra-passe
        </button>
      </div>
    </form>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block font-mono text-xs font-bold">
        {label}
      </label>
      <input
        id={id}
        type="password"
        value={value}
        maxLength={200}
        autoComplete={autoComplete}
        onChange={(event) => onChange(event.target.value)}
        className={INPUT}
      />
    </div>
  );
}

function DeleteForm() {
  const id = useId();
  const client = useQueryClient();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [asking, setAsking] = useState(false);
  const remove = useMutation({
    mutationFn: () => deleteReader(password),
    onSuccess: () => {
      forgetAccount(client);
      router.push("/?conta=apagada");
    },
  });
  const wrong = remove.error instanceof ApiError && remove.error.code === "invalid_credentials";

  return (
    <div className="max-w-xl space-y-3 text-sm">
      <p className="text-muted">Para sempre, sem volta atrás:</p>
      <ul className="list-disc space-y-1 pl-5 text-muted">
        <li>os teus votos, gostos e marcas &quot;Importa&quot; saem das contagens;</li>
        <li>os teus comentários e respostas no fórum são apagados;</li>
        <li>as discussões que abriste ficam, mas em branco (&quot;[apagado]&quot;), para as respostas dos outros não perderem o sítio;</li>
        <li>as notícias guardadas, escondidas e lidas são apagadas.</li>
      </ul>
      <div className="max-w-md">
        <PasswordField
          id={`${id}-password`}
          label="A tua palavra-passe, para confirmar"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
        />
      </div>
      {remove.error && (
        <p role="alert" className="text-danger">
          {wrong ? "A palavra-passe não está certa." : accountErrorMessage(remove.error)}
        </p>
      )}
      {asking ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={remove.isPending}
            onClick={() => remove.mutate()}
            className={`${BUTTON} border-danger text-danger`}
          >
            Apagar a conta de vez
          </button>
          <button type="button" onClick={() => setAsking(false)} className={BUTTON}>
            Cancelar
          </button>
        </div>
      ) : (
        <button type="button" disabled={!password} onClick={() => setAsking(true)} className={`${BUTTON} border-danger text-danger`}>
          Apagar a conta
        </button>
      )}
    </div>
  );
}
