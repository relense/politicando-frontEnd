"use client";

import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { useReader } from "@/lib/account";
import { getNotifications, getUnreadCount, markNotificationsRead, type Notification } from "@/lib/api/engagement";
import { lisbonDay, lisbonDayFrom } from "@/lib/format";
import { INBOX_TABS, notificationHref, notificationText, tabOf, type InboxTab } from "@/lib/notifications";
import { useNow } from "@/lib/useNow";
import { RelativeTime } from "../RelativeTime";

export const UNREAD_KEY = ["notifications", "unread"];
const INBOX_KEY = ["notifications", "inbox"];

/** Unread lines, for the bell: asked every minute while the tab is visible, and again when it's back in view. */
export function useUnreadCount(): number {
  const reader = useReader();
  const query = useQuery({
    queryKey: UNREAD_KEY,
    queryFn: getUnreadCount,
    enabled: Boolean(reader),
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    retry: false,
  });
  return reader ? (query.data ?? 0) : 0;
}

function useInbox(enabled: boolean) {
  const reader = useReader();
  return useInfiniteQuery({
    queryKey: INBOX_KEY,
    queryFn: ({ pageParam }) => getNotifications(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
    enabled: Boolean(reader) && enabled,
    staleTime: 30_000,
  });
}

type InboxPages = { pages: { items: Notification[]; nextCursor: string | null }[]; pageParams: unknown[] };

/** Lines marked read (all of them without ids): at once on the page, then told to the API. */
function useMarkRead() {
  const client = useQueryClient();
  return (ids?: number[]) => {
    client.setQueryData<InboxPages>(INBOX_KEY, (data) =>
      data
        ? {
            ...data,
            pages: data.pages.map((page) => ({
              ...page,
              items: page.items.map((item) => (!ids || ids.includes(item.id) ? { ...item, read: true } : item)),
            })),
          }
        : data,
    );
    client.setQueryData<number>(UNREAD_KEY, (count = 0) => (ids ? Math.max(0, count - ids.length) : 0));
    void markNotificationsRead(ids).finally(() => client.invalidateQueries({ queryKey: UNREAD_KEY }));
  };
}

const BELL = "M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0";

/**
 * The bell beside the avatar. On a computer it opens the latest lines in a panel; on a phone it goes to the inbox
 * page. The yellow number is what's unread; nobody else sees it.
 */
export function NotificationBell() {
  const unread = useUnreadCount();
  const id = useId();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const label = unread > 0 ? `Notificações: ${unread} por ler` : "Notificações";

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    const onDown = (event: PointerEvent) => !box.current?.contains(event.target as Node) && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  // A new page closes the panel.
  const [shownOn, setShownOn] = useState(pathname);
  if (shownOn !== pathname) {
    setShownOn(pathname);
    setOpen(false);
  }

  const icon = (
    <>
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 fill-none stroke-current stroke-2">
        <path d={BELL} strokeLinejoin="round" />
      </svg>
      {unread > 0 && (
        <span
          aria-hidden="true"
          className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#f2c94c] px-1 font-mono text-[10px] font-bold text-[#1b1d22]"
        >
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </>
  );

  return (
    <div ref={box} className="relative">
      <Link
        href="/conta/notificacoes"
        aria-label={label}
        className="relative flex size-9 items-center justify-center rounded-full hover:bg-surface sm:hidden"
      >
        {icon}
      </Link>
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        onClick={() => setOpen(!open)}
        className="relative hidden size-9 items-center justify-center rounded-full hover:bg-surface sm:flex"
      >
        {icon}
      </button>
      {open && (
        <div
          id={`${id}-panel`}
          role="region"
          aria-label="Notificações"
          className="absolute right-0 top-full z-50 mt-2 flex max-h-[75vh] w-[22rem] flex-col overflow-hidden rounded-2xl border border-line bg-[var(--card)] shadow-2xl"
        >
          <InboxBody compact />
        </div>
      )}
    </div>
  );
}

/** The inbox page: every line, by day, with the same tabs. */
export function AccountInbox() {
  const reader = useReader();
  if (reader === undefined) return <p className="text-muted">A verificar a sessão…</p>;
  if (!reader)
    return (
      <div className="max-w-xl rounded-2xl border border-dashed border-line p-6">
        <h1 className="text-2xl font-bold">Notificações</h1>
        <p className="mt-2 text-muted">Entra para veres quem te respondeu e as novidades do que segues.</p>
        <Link href="/entrar?depois=%2Fconta%2Fnotificacoes" className="mt-4 inline-flex font-mono text-sm font-bold underline">
          Entrar
        </Link>
      </div>
    );
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_17rem]">
      <div className="min-w-0 max-w-3xl">
        <h1 className="text-3xl font-bold">Notificações</h1>
        <p className="mt-2 max-w-xl font-mono text-sm leading-relaxed text-muted">
          Uma caixa privada. Sem números públicos de seguidores ou respostas: ninguém compete por atenção, só sabes quando alguém falou
          contigo ou quando algo que segues mudou.
        </p>
        <div className="mt-6 rounded-2xl border border-line">
          <InboxBody />
        </div>
      </div>
      <aside className="flex flex-col gap-4 lg:pt-24">
        <section aria-labelledby="o-que-avisamos" className="rounded-2xl border border-line p-4">
          <h2 id="o-que-avisamos" className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
            O que te avisamos
          </h2>
          <ul className="mt-3 flex flex-col gap-3 text-sm">
            <li>
              <b className="block">Respostas aos teus comentários</b>
              <span className="font-mono text-[11px] text-muted">no site e no fórum, logo que acontece</span>
            </li>
            <li>
              <b className="block">Novidades nas histórias que segues</b>
              <span className="font-mono text-[11px] text-muted">quando outro jornal pega na história</span>
            </li>
            <li>
              <b className="block">Novas respostas nas conversas que segues</b>
              <span className="font-mono text-[11px] text-muted">agrupadas numa só linha</span>
            </li>
            <li>
              <b className="block">As tuas previsões decididas</b>
              <span className="font-mono text-[11px] text-muted">na manhã a seguir à votação</span>
            </li>
          </ul>
        </section>
        <p className="font-mono text-[11px] leading-relaxed text-muted">
          Ninguém vê quantas respostas, seguidores ou previsões tens. Não há contadores públicos. Guardamos as notificações 90 dias.
        </p>
      </aside>
    </div>
  );
}

const ICONS: Record<string, { path: string; tone: string }> = {
  respostas: { path: "M9 14 4 9l5-5M4 9h10a6 6 0 0 1 6 6v5", tone: "#f2c94c" },
  story: { path: "M12 5v14M5 12h14", tone: "#8fa8ff" },
  thread: { path: "M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7", tone: "#b48cff" },
  previsoes: { path: "m5 12 4.5 4.5L19 7", tone: "#5fcf9a" },
};

function iconOf(item: Notification) {
  const tab = tabOf(item);
  if (tab === "seguir") return item.kind === "story_update" ? ICONS.story! : ICONS.thread!;
  return ICONS[tab]!;
}

function InboxBody({ compact = false }: { compact?: boolean }) {
  const [tab, setTab] = useState<InboxTab>("tudo");
  const inbox = useInbox(true);
  const markRead = useMarkRead();
  const now = useNow();
  const all = inbox.data?.pages.flatMap((page) => page.items) ?? [];
  const items = tab === "tudo" ? all : all.filter((item) => tabOf(item) === tab);
  const shown = compact ? items.slice(0, 6) : items;
  const count = (key: InboxTab) => (key === "tudo" ? all.length : all.filter((item) => tabOf(item) === key).length);
  const unread = all.some((item) => !item.read);

  const today = lisbonDayFrom(now, 0);
  const yesterday = lisbonDayFrom(now, -1);
  const dayLabel = (value: string) => {
    const day = lisbonDay(value);
    return day === today ? "Hoje" : day === yesterday ? "Ontem" : "Mais antigas";
  };

  return (
    <>
      {compact && (
        <div className="flex items-center justify-between gap-3 px-3 pt-3">
          <p className="font-serif text-lg font-bold">Notificações</p>
          {unread && (
            <button
              type="button"
              onClick={() => markRead()}
              className="font-mono text-[11px] text-muted underline-offset-2 hover:text-ink hover:underline"
            >
              Marcar tudo como lido
            </button>
          )}
        </div>
      )}
      <div className="flex items-end border-b border-line">
        <div role="tablist" aria-label="Que notificações" className="flex min-w-0 flex-1 gap-1 overflow-x-auto px-2 pt-2">
          {INBOX_TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={tab === item.key}
              onClick={() => setTab(item.key)}
              className={`shrink-0 border-b-2 px-2.5 py-2 font-mono text-[11px] font-bold ${
                tab === item.key ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"
              }`}
            >
              {item.label}
              {!compact && <span className="ml-1 font-normal text-muted">{count(item.key)}</span>}
            </button>
          ))}
        </div>
        {!compact && unread && (
          <button
            type="button"
            onClick={() => markRead()}
            className="shrink-0 self-center px-2 font-mono text-[11px] text-muted hover:text-ink hover:underline"
          >
            Marcar tudo como lido
          </button>
        )}
      </div>
      <div role="tabpanel" className={compact ? "min-h-0 flex-1 overflow-y-auto p-2" : "p-2"}>
        {inbox.isPending ? (
          <p className="p-4 text-sm text-muted">A carregar…</p>
        ) : inbox.isError ? (
          <p className="p-4 text-sm text-danger">Não foi possível carregar. Tenta outra vez daqui a pouco.</p>
        ) : shown.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted">
            {tab === "tudo"
              ? "Ainda não há notificações. Quando alguém te responder, ou houver novidades no que segues, aparece aqui."
              : "Nada aqui por agora."}
          </p>
        ) : (
          <ul aria-label="Notificações" className="flex flex-col gap-1">
            {shown.map((item, index) => {
              const heading = !compact && (index === 0 || dayLabel(shown[index - 1]!.createdAt) !== dayLabel(item.createdAt));
              return (
                <li key={item.id}>
                  {heading && (
                    <p className="px-2 pb-1 pt-3 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
                      {dayLabel(item.createdAt)}
                    </p>
                  )}
                  <InboxLine item={item} onOpen={() => !item.read && markRead([item.id])} />
                </li>
              );
            })}
          </ul>
        )}
        {!compact && inbox.hasNextPage && (
          <button
            type="button"
            onClick={() => void inbox.fetchNextPage()}
            disabled={inbox.isFetchingNextPage}
            className="m-2 rounded-full border border-line px-4 py-2 font-mono text-xs font-bold hover:bg-surface"
          >
            Ver mais antigas
          </button>
        )}
      </div>
      {compact && (
        <div className="flex items-center justify-between border-t border-line px-3 py-2 font-mono text-[11px]">
          <Link href="/conta/notificacoes" className="font-bold underline">
            Ver todas →
          </Link>
          <span className="text-muted">Só tu vês isto</span>
        </div>
      )}
    </>
  );
}

function InboxLine({ item, onOpen }: { item: Notification; onOpen: () => void }) {
  const text = notificationText(item);
  const href = notificationHref(item);
  const icon = iconOf(item);
  const reply = tabOf(item) === "respostas" && href;
  return (
    <div className={`relative flex gap-3 rounded-xl p-2.5 ${item.read ? "" : "bg-[color-mix(in_srgb,#f2c94c_7%,var(--card))]"}`}>
      <span
        aria-hidden="true"
        className="flex size-7 shrink-0 items-center justify-center rounded-lg"
        style={{ color: icon.tone, background: `color-mix(in srgb, ${icon.tone} 16%, transparent)` }}
      >
        <svg viewBox="0 0 24 24" className="size-4 fill-none stroke-current stroke-2">
          <path d={icon.path} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <div className="min-w-0 flex-1 pr-3">
        <p className="text-sm leading-snug">
          {href ? (
            <Link href={href} onClick={onOpen} className="after:absolute after:inset-0 hover:underline">
              {text.actor && <b>{text.actor} </b>}
              {text.lead}
            </Link>
          ) : (
            <>
              {text.actor && <b>{text.actor} </b>}
              {text.lead}
            </>
          )}
        </p>
        {text.quote && <p className="mt-1.5 border-l-2 border-line pl-3 text-sm italic text-muted">“{text.quote}”</p>}
        <p className="mt-1 flex items-center gap-3 font-mono text-[11px] text-muted">
          <RelativeTime value={item.createdAt} />
          {reply && (
            <Link href={href} onClick={onOpen} className="relative z-10 font-bold text-ink hover:underline">
              Responder →
            </Link>
          )}
        </p>
      </div>
      {!item.read && <span role="img" aria-label="Por ler" className="absolute right-2.5 top-3.5 size-2 rounded-full bg-[#f2c94c]" />}
    </div>
  );
}
