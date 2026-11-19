"use client";

import { useQueryClient } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { markSignedOut, pullAccountState, useReader, type LoginAsk } from "@/lib/account";
import type { Reader } from "@/lib/api/account";
import { createComment, likeComment, LOGIN_REQUIRED_EVENT, markPost, voteArticle } from "@/lib/api/client";
import { voteThread } from "@/lib/api/forums";
import { markImporta } from "@/lib/api/stories";
import { takePending, writeDraft, type PendingAction } from "@/lib/pendingAction";
import { applyVoteAnswer } from "../ArticleVote";
import { applyLikeAnswer } from "../CommentLike";
import { applyIdeaAnswer } from "../forum/IdeaVote";
import { applyImportaAnswer } from "../ImportaButton";
import { applyPostAnswer } from "../PostImporta";
import { useReturnPath } from "./AccountMenu";
import { LoginNote } from "./LoginNote";

type Done = { text: string; href?: string; failed?: boolean };

/**
 * On every page: fills this browser's lists from the account once per visit; asks for an account when taking part
 * needs one (a button asked, or the API answered `login_required`); and, back from logging in, finishes what the reader
 * had started on this page and says so. Renders nothing otherwise.
 */
/**
 * `<html data-account="ready">` once the reader is known and their account's lists are applied: before that, a vote or
 * a menu opened can be redrawn by the account's state. The e2e tests wait for it (gotoReady in e2e/helpers.ts).
 */
const markReady = () => document.documentElement.setAttribute("data-account", "ready");

export function AccountRuntime() {
  const reader = useReader();
  const pathname = usePathname();
  const back = useReturnPath();
  const client = useQueryClient();
  const [ask, setAsk] = useState<LoginAsk | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const close = useCallback(() => setAsk(null), []);

  useEffect(() => {
    if (!reader) {
      if (reader === null) {
        markSignedOut();
        markReady();
      }
      return;
    }
    let live = true;
    void (async () => {
      // The account's lists first, so the finished action isn't overwritten by them.
      await pullAccountState(reader).finally(markReady);
      const action = takePending(pathname);
      if (!action || !live) return;
      const result = await finish(action, reader, client);
      if (live) setDone(result);
    })();
    return () => {
      live = false;
    };
  }, [reader, pathname, client]);

  useEffect(() => {
    const listen = (event: Event) => {
      const detail = event instanceof CustomEvent ? (event.detail as LoginAsk | undefined) : undefined;
      setAsk(detail ?? { kind: "any", anchor: null, pending: null });
    };
    window.addEventListener(LOGIN_REQUIRED_EVENT, listen);
    return () => window.removeEventListener(LOGIN_REQUIRED_EVENT, listen);
  }, []);

  useEffect(() => {
    if (!done) return;
    const timer = setTimeout(() => setDone(null), 8000);
    return () => clearTimeout(timer);
  }, [done]);

  return (
    <>
      {ask && !reader && <LoginNote ask={ask} back={back} onClose={close} />}
      {/* Only while there's something to say: pages have status messages of their own. */}
      {done && (
        <div role="status" className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex justify-center">
          <p
            className={`pointer-events-auto flex items-center gap-3 rounded-xl px-4 py-3 font-mono text-xs font-bold shadow-xl ${
              done.failed ? "bg-[var(--card)] text-danger ring-1 ring-line" : "bg-ink text-paper"
            }`}
          >
            <span aria-hidden="true">{done.failed ? "!" : "✓"}</span>
            {done.text}
            {done.href && (
              <a href={done.href} onClick={() => setDone(null)} className="underline">
                Ver
              </a>
            )}
          </p>
        </div>
      )}
    </>
  );
}

/** Does what the reader asked for before logging in, and says what happened. */
async function finish(action: PendingAction, reader: Reader, client: ReturnType<typeof useQueryClient>): Promise<Done> {
  try {
    switch (action.kind) {
      case "comment": {
        const created = await createComment({
          target: action.target,
          parentId: action.parentId,
          username: reader.username,
          text: action.text,
          captchaToken: null,
          stance: action.stance,
        });
        writeDraft(action.target, action.parentId, "");
        await client.invalidateQueries({ queryKey: ["comments", action.target] });
        return {
          text: `Sessão iniciada. ${action.parentId === null ? "O teu comentário foi publicado." : "A tua resposta foi publicada."}`,
          href: `#comentario-${created.id}`,
        };
      }
      case "importa":
        applyImportaAnswer(action.id, await markImporta(action.id, 1));
        return { text: "Sessão iniciada. Marcaste “Importa” nesta notícia." };
      case "vote":
        applyVoteAnswer(action.id, await voteArticle(action.id, action.value));
        return { text: "Sessão iniciada. O teu voto contou." };
      case "post":
        applyPostAnswer(action.slug, await markPost(action.slug, 1));
        return { text: "Sessão iniciada. Marcaste “Importa” neste artigo." };
      case "like":
        applyLikeAnswer(action.id, await likeComment(action.id, 1));
        return { text: "Sessão iniciada. O teu gosto contou." };
      case "idea":
        applyIdeaAnswer(action.id, await voteThread(action.id));
        return { text: "Sessão iniciada. O teu voto na ideia contou." };
    }
  } catch {
    // The comment stays in its box (its draft), to publish by hand.
    return action.kind === "comment"
      ? { text: "Sessão iniciada, mas o comentário não foi publicado. Ficou na caixa para tentares outra vez.", failed: true }
      : { text: "Sessão iniciada, mas não contou. Tenta outra vez.", failed: true };
  }
}
