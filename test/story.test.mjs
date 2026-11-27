import assert from "node:assert/strict";
import { test } from "node:test";
import { story } from "../src/phone/story.js";

// A page 900 px tall in view and two feature sections of 700 px each from 1000 px down.
const page = {
  viewport: 900,
  sections: [
    { screens: ["new-program"], top: 1000, bottom: 1700 },
    { screens: ["logging"], top: 1700, bottom: 2400 },
  ],
};
const at = (scrollY) => story({ ...page, scrollY });

test("at the top the phone is yet to turn into place, with Today on its screen", () => {
  assert.deepEqual(at(0), { turn: 0, screen: "today" });
});

test("the phone's turn is over within the first quarter of a view of scroll", () => {
  assert.equal(at(56.25).turn, 0.25);
  assert.equal(at(112.5).turn, 0.5);
  assert.equal(at(225).turn, 1);
});

test("from there on the phone stands still: the scroll says nothing more about its pose", () => {
  for (const scrollY of [225, 549, 550, 875, 1250, 5000]) {
    const { screen, ...pose } = at(scrollY);
    assert.deepEqual(pose, { turn: 1 }, `at ${scrollY}`);
  }
});

test("scrolling back to the top turns the phone away again", () => {
  assert.equal(at(5000).turn, 1);
  assert.equal(at(112.5).turn, 0.5);
  assert.equal(at(0).turn, 0);
});

test("the section across the middle of the view sets the screen, and Today is on until the first", () => {
  assert.equal(at(549).screen, "today");
  assert.equal(at(550).screen, "new-program");
  assert.equal(at(1249).screen, "new-program");
  assert.equal(at(1250).screen, "logging");
  assert.equal(at(5000).screen, "logging");
});

test("a section whole in view has its screen on the phone, wherever in the view it stands", () => {
  // The shortest a section gets on the page: 56 % of the view.
  const short = { ...page, sections: [
    { screens: ["new-program"], top: 1000, bottom: 1504 },
    { screens: ["logging"], top: 1504, bottom: 2008 },
  ] };
  // From its end at the foot of the view to its top at the view's.
  for (let scrollY = 1504 - 900; scrollY <= 1000; scrollY++) {
    assert.equal(story({ ...short, scrollY }).screen, "new-program", `at ${scrollY}`);
  }
});

test("a section with two screens shows the first through its first half and the second after", () => {
  const two = { ...page, sections: [{ screens: ["exercise", "exercise-muscles"], top: 1000, bottom: 1700 }] };
  const shown = (scrollY) => story({ ...two, scrollY }).screen;
  assert.equal(shown(550), "exercise");
  assert.equal(shown(899), "exercise");
  assert.equal(shown(900), "exercise-muscles");
  assert.equal(shown(5000), "exercise-muscles");
});

test("a bounce above the top doesn't turn the phone past where it starts", () => {
  assert.equal(at(-40).turn, 0);
});
