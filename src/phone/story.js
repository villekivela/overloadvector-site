// What the home page's phone shows at a scroll position. No three.js here: this is the part of
// the animation that can be checked without a browser.

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

/**
 * `turn` runs from 0 (the back faces the reader) to 1 (the front does) over the first `turnOver`
 * pixels of scroll. `screen` is that of the feature section lying across a line a third of the
 * way down the view, where its words have come up to be read, or Today above the first. `drift`
 * sways once as that section crosses the line: to -1, level at the section's middle, to 1 and
 * level again, so it is the same on both sides of every change of section.
 * `sections` are in page order, their `top` and `bottom` measured from the top of the page.
 */
export function story({ scrollY, viewport, turnOver, sections }) {
  const line = scrollY + viewport / 3;
  const turn = clamp(scrollY / turnOver, 0, 1);
  const section = sections.findLast(({ top }) => top <= line);
  if (!section) return { turn, screen: "today", drift: 0 };
  const through = clamp((line - section.top) / (section.bottom - section.top), 0, 1);
  return { turn, screen: section.screen, drift: -Math.sin(2 * Math.PI * through) };
}
