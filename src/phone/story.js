// What the home page's phone shows at a scroll position. No three.js here: this is the part of
// the animation that can be checked without a browser.

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

/**
 * `turn` runs from 0 (the back faces the reader) to 1 (the front does) over the first `turnOver`
 * pixels of scroll. `screen` is that of the feature section lying across the middle of the view,
 * or Today above the first. `drift` runs from -1 to 1 as that section passes the middle.
 * `sections` are in page order, their `top` and `bottom` measured from the top of the page.
 */
export function story({ scrollY, viewport, turnOver, sections }) {
  const middle = scrollY + viewport / 2;
  const turn = clamp(scrollY / turnOver, 0, 1);
  const section = sections.findLast(({ top }) => top <= middle);
  if (!section) return { turn, screen: "today", drift: 0 };
  const half = (section.bottom - section.top) / 2;
  const drift = clamp((middle - section.top - half) / half, -1, 1);
  return { turn, screen: section.screen, drift };
}
