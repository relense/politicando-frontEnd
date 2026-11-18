import { PageSkeleton } from "@/components/Skeletons";

/** This page can't 404, so a loading screen can't turn a 404 into a 200. Keep it that way, or move this into a group. */
export default function Loading() {
  return <PageSkeleton label="A carregar a história…" before="Os governos da" marked="democracia" body="timeline" />;
}
