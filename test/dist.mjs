// Reads the built site, which is what a visitor gets.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

export const DIST = fileURLToPath(new URL("../dist/", import.meta.url));

/** Every built file, as a path under dist/. */
export function builtFiles() {
  if (!existsSync(DIST)) return [];
  return readdirSync(DIST, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(DIST, join(entry.parentPath, entry.name)));
}

export function read(path) {
  return readFileSync(join(DIST, path));
}

/** The HTML a visitor gets at a route such as `/` or `/privacy/`. */
export function page(route) {
  const path = join(route.slice(1), "index.html");
  if (!existsSync(join(DIST, path))) throw new Error(`no page at ${route} (dist/${path})`);
  return read(path).toString("utf8");
}
