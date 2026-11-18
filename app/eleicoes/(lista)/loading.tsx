import { PageSkeleton } from "@/components/Skeletons";

/** The list only (a group of its own): the pages under it can 404, and a loading boundary would turn that into a 200. */
export default function Loading() {
  return <PageSkeleton label="A carregar as eleições…" marked="Eleições" body="cards" />;
}
