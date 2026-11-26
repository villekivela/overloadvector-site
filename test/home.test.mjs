import assert from "node:assert/strict";
import { test } from "node:test";
import { page } from "./dist.mjs";

test("the home page names Overload Vector", () => {
  assert.match(page("/"), /<h1[^>]*>\s*Overload Vector\s*<\/h1>/);
});

test("the home page's address is on overloadvector.com", () => {
  assert.match(page("/"), /<link rel="canonical" href="https:\/\/overloadvector\.com\/"\s*\/?>/);
});
