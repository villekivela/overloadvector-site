// A headless Chrome on the built site, for what only a browser can tell: what a visitor sees in
// each theme and at each width, and which fonts draw it.
import { createServer } from "node:http";
import { extname } from "node:path";
import { openBrowser, TYPES } from "../scripts/chrome.mjs";
import { builtFiles, read } from "./dist.mjs";

/** Serves dist/ as GitHub Pages would: a folder's address answers with its index.html. */
async function serve() {
  const files = new Set(builtFiles());
  const server = createServer((request, response) => {
    let path = decodeURI(new URL(request.url, "http://site").pathname).slice(1);
    if (path === "" || path.endsWith("/")) path += "index.html";
    if (!files.has(path)) return response.writeHead(404).end();
    response.writeHead(200, { "content-type": TYPES[extname(path)] ?? "application/octet-stream" });
    response.end(read(path));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return server;
}

/** Opens a browser tab on the built site: `visit` takes a route, and the rest is the browser's. */
export async function openSite() {
  const server = await serve();
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await openBrowser();
  return {
    ...browser,
    origin,
    visit: (route) => browser.visit(origin + route),
    async close() {
      await browser.close();
      server.close();
    },
  };
}
