import { connection } from "next/server";
import { Feed } from "@/components/Feed";
import { PartyChipBar } from "@/components/PartyNav";
import { getFeedPage, getParties } from "@/lib/api/client";
import { SOURCE_COUNT } from "@/lib/sources";

export default async function HomePage() {
  await connection();
  const [page, parties] = await Promise.all([getFeedPage(), getParties().catch(() => [])]);

  return (
    <>
      <PartyChipBar parties={parties} />
      <header className="mb-8">
        <h1 className="text-3xl font-bold leading-tight sm:text-4xl">Últimas notícias</h1>
        <p className="mt-2 font-mono text-xs text-muted">De {SOURCE_COUNT} órgãos de comunicação, de todos os partidos, por ordem de publicação.</p>
      </header>
      <Feed initialPage={page} />
    </>
  );
}
