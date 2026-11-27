// A headless Chrome on the built site, for what only a browser can tell: what a visitor sees in
// each theme and at each width, and which fonts draw it.
import { createServer } from "node:http";
import { extname } from "node:path";
import { openBrowser, TYPES } from "../scripts/chrome.mjs";
import { builtFiles, read } from "./dist.mjs";

/** Serves dist/ as GitHub Pages would: a folder's address answers with its index.html, and a range with its part. */
async function serve() {
  const files = new Set(builtFiles());
  const server = createServer((request, response) => {
    let path = decodeURI(new URL(request.url, "http://site").pathname).slice(1);
    if (path === "" || path.endsWith("/")) path += "index.html";
    if (!files.has(path)) return response.writeHead(404).end();
    const body = read(path);
    const type = { "content-type": TYPES[extname(path)] ?? "application/octet-stream", "accept-ranges": "bytes" };
    // A part of a file, as a video asks for to seek and to loop.
    const range = request.headers.range?.match(/^bytes=(\d*)-(\d*)$/);
    if (!range) return response.writeHead(200, type).end(body);
    const start = range[1] ? Number(range[1]) : body.length - Number(range[2]);
    const end = range[1] && range[2] ? Math.min(Number(range[2]), body.length - 1) : body.length - 1;
    if (start >= body.length) return response.writeHead(416, { "content-range": `bytes */${body.length}` }).end();
    response.writeHead(206, { ...type, "content-range": `bytes ${start}-${end}/${body.length}` });
    response.end(body.subarray(start, end + 1));
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
    /** Leaves the site, for a blank page. */
    leave: () => browser.visit("about:blank"),
    async close() {
      await browser.close();
      server.close();
    },
  };
}
