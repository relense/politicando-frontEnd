import { connection } from "next/server";
import { Feed } from "@/components/Feed";
import { getFeedPage } from "@/lib/api/client";

export default async function HomePage() {
  await connection();
  const page = await getFeedPage();

  return (
    <>
      <h1 className="mb-6 font-mono text-sm font-bold uppercase tracking-widest text-muted">Últimas notícias</h1>
      <Feed initialPage={page} />
    </>
  );
}
