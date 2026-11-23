import type { Metadata } from "next";
import { FollowedProposals } from "@/components/account/FollowedProposals";

export const metadata: Metadata = {
  title: "A seguir",
  robots: { index: false, follow: false },
};

export default function FollowingPage() {
  return <FollowedProposals />;
}
