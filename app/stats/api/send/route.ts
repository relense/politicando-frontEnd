import { forwardToUmami } from "@/lib/umami";

/** Umami's events, sent by its script to our own address (data-host-url="/stats"): on to Umami with the reader's IP and browser. */
export async function POST(request: Request): Promise<Response> {
  return forwardToUmami(request);
}
