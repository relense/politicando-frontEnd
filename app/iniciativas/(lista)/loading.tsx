import { InitiativesSkeleton } from "@/components/Skeletons";

/** The list only (a group of its own): a single initiative can 404, and a loading boundary would turn that into a 200. */
export default function Loading() {
  return <InitiativesSkeleton />;
}
