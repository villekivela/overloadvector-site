// What the home page's phone shows at a scroll position. No three.js here: this is the part of
// the animation that can be checked without a browser.

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

// How much scroll the phone's turn into place takes, as a share of the view's height.
const TURN = 1 / 4;
// A section takes the phone as it crosses this far down the view: by then it is mostly in view.
// No higher up than the middle, or a section still whole in view could lose the phone to the next.
const LINE = 1 / 2;

/**
 * `turn` runs from 0 (the phone a little turned away, as the page opens) to 1 (in place, facing the
 * reader) over the first `TURN` of a view of scroll, and stays there. `screen` is that of the
 * feature section lying across `LINE`, or Today above the first. A section with several `screens`
 * shows them in turn, an equal share of its height each.
 * `sections` are in page order, their `top` and `bottom` measured from the top of the page.
 */
export function story({ scrollY, viewport, sections }) {
  const line = scrollY + viewport * LINE;
  const turn = clamp(scrollY / (viewport * TURN), 0, 1);
  const section = sections.findLast(({ top }) => top <= line);
  if (!section) return { turn, screen: "today" };
  const through = clamp((line - section.top) / (section.bottom - section.top), 0, 1);
  const { screens } = section;
  const screen = screens[Math.min(screens.length - 1, Math.floor(through * screens.length))];
  return { turn, screen };
}
