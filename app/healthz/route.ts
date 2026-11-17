// Render's health check. It never calls the API, so an API hiccup can't make Render restart the frontend.
export const dynamic = "force-dynamic";

export function GET() {
  return new Response("ok", { headers: { "cache-control": "no-store" } });
}
