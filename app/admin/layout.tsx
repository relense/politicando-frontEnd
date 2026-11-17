import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin/AdminShell";

export const metadata: Metadata = {
  title: "Moderação",
  robots: { index: false, follow: false },
};

/** The team's moderation area. Everything inside runs in the browser, against the API through this site's server. */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div data-wide>
      <AdminShell>{children}</AdminShell>
    </div>
  );
}
