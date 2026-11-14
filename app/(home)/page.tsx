import { connection } from "next/server";
import { Feed } from "@/components/Feed";
import { PartyChipBar } from "@/components/PartyNav";
import { getFeedPage, getParties } from "@/lib/api/client";

export default async function HomePage() {
  await connection();
  const [page, parties] = await Promise.all([getFeedPage(), getParties().catch(() => [])]);

  return (
    <>
      <PartyChipBar parties={parties} />
      <h1 className="mb-6 font-mono text-sm font-bold uppercase tracking-widest text-muted">Últimas notícias</h1>
      <Feed initialPage={page} />
    </>
  );
}
