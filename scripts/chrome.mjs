// A headless Chrome driven over the DevTools protocol: the tests look at the built site with it,
// and the stills script draws the home page's phone with it.
import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const TYPES = {
  ".css": "text/css",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".wasm": "application/wasm",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
};

function chromeBinary() {
  const names = process.env.CHROME ? [process.env.CHROME] : ["google-chrome", "chromium"];
  for (const name of names) {
    try {
      return execFileSync("which", [name], { encoding: "utf8", stdio: "pipe" }).trim();
    } catch {
      // Try the next.
    }
  }
  throw new Error(`no browser: install Chrome or set CHROME (looked for ${names.join(", ")})`);
}

/**
 * Opens a browser tab. `visit` loads an address, `run` evaluates a function in the page, `send` is
 * the protocol itself, and `requests` collects every address the pages asked for.
 */
export async function openBrowser() {
  const profile = mkdtempSync(join(tmpdir(), "site-chrome-"));
  const chrome = spawn(
    chromeBinary(),
    [
      "--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`,
      "--mute-audio", "--no-first-run",
      // Where there is no graphics card, as on a CI runner, WebGL is drawn in software.
      "--enable-unsafe-swiftshader",
      // A CI runner's own sandbox stands in for Chrome's, which it doesn't allow.
      ...(process.env.CI ? ["--no-sandbox"] : []),
      "about:blank",
    ],
    { stdio: ["ignore", "ignore", "pipe"] },
  );
  const endpoint = await new Promise((resolve, reject) => {
    let said = "";
    const timer = setTimeout(() => reject(new Error(`the browser didn't start: ${said}`)), 30_000);
    chrome.stderr.on("data", (chunk) => {
      said += chunk;
      const found = said.match(/DevTools listening on (ws:\/\/\S+)/);
      if (found) {
        clearTimeout(timer);
        resolve(found[1]);
      }
    });
  });

  const socket = new WebSocket(endpoint);
  await new Promise((resolve) => socket.addEventListener("open", resolve, { once: true }));
  let id = 0;
  const waiting = new Map();
  const requests = [];
  let loaded = () => {};
  socket.addEventListener("message", ({ data }) => {
    const message = JSON.parse(data);
    if (message.method === "Page.loadEventFired") loaded();
    if (message.method === "Network.requestWillBeSent") requests.push(message.params.request.url);
    if (!message.id) return;
    const { resolve, reject } = waiting.get(message.id);
    waiting.delete(message.id);
    message.error ? reject(new Error(message.error.message)) : resolve(message.result);
  });
  const raw = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      waiting.set(++id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params, sessionId }));
    });
  const { targetId } = await raw("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await raw("Target.attachToTarget", { targetId, flatten: true });
  const send = (method, params) => raw(method, params, sessionId);
  await send("Page.enable");
  await send("Network.enable");

  async function run(fn, ...args) {
    const { result, exceptionDetails } = await send("Runtime.evaluate", {
      expression: `(${fn})(...${JSON.stringify(args)})`,
      awaitPromise: true,
      returnByValue: true,
    });
    if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
    return result.value;
  }

  return {
    requests,
    send,
    run,
    async visit(url) {
      const load = new Promise((resolve) => (loaded = resolve));
      await send("Page.navigate", { url });
      await load;
      await run(async () => {
        await document.fonts.ready;
        return true;
      });
    },
    async close() {
      socket.close();
      const gone = new Promise((resolve) => chrome.once("exit", resolve));
      chrome.kill();
      await gone;
      rmSync(profile, { recursive: true, force: true, maxRetries: 5 });
    },
  };
}
