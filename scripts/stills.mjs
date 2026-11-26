// Draws the home page's still phones: the page's own model (src/phone/phone.js), rendered in a
// headless Chrome with each screenshot on its screen. Run it after the model or a screenshot the
// home page shows changes: npm run stills.
import { createServer } from "node:http";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { openBrowser, TYPES } from "./chrome.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const OUT = "src/assets/phone";
// The screens the home page shows, in its order.
const SCREENS = ["today", "new-program", "logging", "mannequin", "muscles", "progress", "check-in"];
const [WIDTH, HEIGHT] = [720, 1200];

const server = createServer((request, response) => {
  const path = normalize(decodeURI(new URL(request.url, "http://site").pathname)).slice(1);
  const served = /^(scripts\/stills\.html|src\/phone\/|src\/assets\/shots\/|node_modules\/three\/)/.test(path);
  if (!served || !existsSync(join(ROOT, path))) return response.writeHead(404).end();
  response.writeHead(200, { "content-type": TYPES[extname(path)] ?? "application/octet-stream" });
  response.end(readFileSync(join(ROOT, path)));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const browser = await openBrowser();
try {
  await browser.visit(`http://127.0.0.1:${server.address().port}/scripts/stills.html`);
  const draw = async (name, pose, theme, shot) => {
    const url = await browser.run((...args) => window.still(...args), pose, theme, WIDTH, HEIGHT, shot);
    writeFileSync(join(ROOT, OUT, `${name}.png`), Buffer.from(url.split(",")[1], "base64"));
    console.log(`${OUT}/${name}.png`);
  };
  for (const theme of ["light", "dark"]) {
    await draw(`phone-back-${theme}`, "back", theme);
    for (const screen of SCREENS) {
      await draw(`phone-${screen}-${theme}`, "front", theme, `/src/assets/shots/shot-${screen}-${theme}.png`);
    }
  }
} finally {
  await browser.close();
  server.close();
}
