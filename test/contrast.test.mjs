import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { openSite } from "./browser.mjs";

// WCAG AA: text reads at 4.5:1 against what lies behind it, large text at 3:1 (24 px, or 18.66 px
// bold), and so does the part of a control that tells its state.
const ROUTES = ["/", "/docs/getting-started/", "/docs/program-format/", "/faq/", "/privacy/"];

let site;
before(async () => (site = await openSite()));
after(() => site?.close());

/** What reads too faintly on the page now: each as its words, its ratio and the ratio it needs. */
const faint = () =>
  site.run(() => {
    const pen = Object.assign(document.createElement("canvas"), { width: 1, height: 1 }).getContext("2d", { willReadFrequently: true });
    // A colour as the browser paints it, whatever way it is written: red, green, blue and alpha, 0 to 1.
    const parse = (colour) => {
      pen.clearRect(0, 0, 1, 1);
      pen.fillStyle = colour;
      pen.fillRect(0, 0, 1, 1);
      return [...pen.getImageData(0, 0, 1, 1).data].map((value) => value / 255);
    };
    const over = ([r, g, b, a], [br, bg, bb]) => [r * a + br * (1 - a), g * a + bg * (1 - a), b * a + bb * (1 - a), 1];
    const light = ([r, g, b]) => {
      const [x, y, z] = [r, g, b].map((value) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
      return 0.2126 * x + 0.7152 * y + 0.0722 * z;
    };
    const ratio = (one, other) => {
      const [high, low] = [light(one), light(other)].sort((a, b) => b - a);
      return (high + 0.05) / (low + 0.05);
    };
    /** The colour behind an element: its own background and its ancestors', one over the other. */
    const behind = (element) => {
      const layers = [];
      for (let at = element; at; at = at.parentElement) {
        const colour = parse(getComputedStyle(at).backgroundColor);
        if (colour[3] > 0) layers.push(colour);
        if (colour[3] === 1) break;
      }
      return layers.reduceRight((under, layer) => over(layer, under), [1, 1, 1, 1]);
    };
    const seen = (element) => {
      const style = getComputedStyle(element);
      if (style.visibility === "hidden" || element.closest(".sr-only, [hidden], svg")) return false;
      const { width, height } = element.getBoundingClientRect();
      return width > 1 && height > 1;
    };
    const found = [];
    const check = (what, colour, element, needs) => {
      const back = behind(element);
      const got = ratio(over(parse(colour), back), back);
      if (got < needs) found.push(`${what}: ${got.toFixed(2)}, needs ${needs}`);
    };
    const needed = (style) => {
      const size = parseFloat(style.fontSize);
      return size >= 24 || (size >= 18.66 && Number(style.fontWeight) >= 700) ? 3 : 4.5;
    };
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const element = node.parentElement;
      if (!node.textContent.trim() || element.closest("script, style, select") || !seen(element)) continue;
      const style = getComputedStyle(element);
      check(`"${node.textContent.trim().slice(0, 40)}"`, style.color, element, needed(style));
    }
    // A step's number is drawn by the stylesheet, so it is no text of the page's.
    for (const step of document.querySelectorAll(".sl-markdown-content ol > li")) {
      const style = getComputedStyle(step, "::before");
      if (seen(step) && style.content !== "none") check("a step's number", style.color, step, needed(style));
    }
    // What tells a control's state: the line under the header's current part and beside the
    // sidebar's current page, the switch's rim, and a chip's.
    for (const [what, selector, colour] of [
      ["the header's current part", ".site-links a[aria-current]", (style) => style.boxShadow.match(/(rgb|color)\([^)]*\)/)?.[0]],
      ["the sidebar's current page", ".sidebar-content a[aria-current]", (style) => style.boxShadow.match(/(rgb|color)\([^)]*\)/)?.[0]],
      ["the switch's rim", ".switch i", (style) => style.borderTopColor],
      ["a chip's rim", ".rir button", (style) => style.borderTopColor],
      ["a button's rim", ".ov-alt, .outcomes button", (style) => style.borderTopColor],
    ]) {
      for (const element of document.querySelectorAll(selector)) {
        if (seen(element)) check(what, colour(getComputedStyle(element)), element.parentElement, 3);
      }
    }
    return [...new Set(found)];
  });

for (const theme of ["dark", "light"]) {
  for (const route of ROUTES) {
    test(`${route} reads at AA contrast in the ${theme} theme`, async () => {
      await site.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
      // Less motion, so the home page shows every section's words and stills at once and nothing is mid-fade.
      await site.send("Emulation.setEmulatedMedia", {
        features: [{ name: "prefers-color-scheme", value: theme }, { name: "prefers-reduced-motion", value: "reduce" }],
      });
      await site.visit(route);
      await site.run((theme) => {
        const select = document.querySelector("starlight-theme-select select");
        select.value = theme;
        select.dispatchEvent(new Event("change"));
      }, theme);
      assert.deepEqual(await faint(), []);
      if (route !== "/") return;
      // The home page again with each of its controls pressed.
      await site.run(() => {
        document.querySelector("#layer").click();
        for (const chip of document.querySelectorAll(".rir button")) chip.setAttribute("aria-pressed", "true");
        for (const outcome of document.querySelectorAll(".outcomes button")) outcome.setAttribute("aria-pressed", "true");
      });
      assert.deepEqual(await faint(), []);
    });
  }
}
