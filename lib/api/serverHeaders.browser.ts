/** Outside React's server layer (the browser, or client components rendering on the server) nothing is added. */
export async function serverHeaders(cachedRequest: boolean): Promise<Record<string, string>> {
  void cachedRequest;
  return {};
}
