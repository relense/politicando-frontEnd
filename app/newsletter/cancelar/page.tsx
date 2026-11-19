import type { Metadata } from "next";
import { NewsletterLink } from "@/components/NewsletterLink";

export const metadata: Metadata = { title: "Cancelar a newsletter", robots: { index: false, follow: false } };

type Props = { searchParams: Promise<{ token?: string | string[] }> };

/** A link in the newsletter's emails; acts only on the button (components/NewsletterLink). */
export default async function Page({ searchParams }: Props) {
  const { token } = await searchParams;
  return <NewsletterLink action="unsubscribe" token={typeof token === "string" ? token : ""} />;
}
