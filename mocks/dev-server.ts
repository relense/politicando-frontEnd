// Serves the MSW handlers over real HTTP, so `next dev` and Playwright can use them.
import { Buffer } from "node:buffer";
import { createServer } from "node:http";
import { getResponse } from "msw";
import { handlers } from "./handlers";

const PORT = Number(process.env.MOCK_API_PORT ?? 4000);
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS).end();
    return;
  }
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const body = chunks.length > 0 ? Buffer.concat(chunks) : undefined;

  const response = await getResponse(
    handlers,
    new Request(`http://localhost:${PORT}${req.url}`, {
      method: req.method,
      headers: { "Content-Type": req.headers["content-type"] ?? "application/json" },
      body,
    }),
  );
  if (!response) {
    res.writeHead(404, CORS).end();
    return;
  }
  res.writeHead(response.status, { ...CORS, "Content-Type": response.headers.get("content-type") ?? "application/json" });
  res.end(Buffer.from(await response.arrayBuffer()));
}).listen(PORT, () => console.log(`Mock API on http://localhost:${PORT}/api/v1`));
