import { describe, it, expect, beforeAll, beforeEach } from "vitest";

/**
 * Geometry is stubbed with the real numbers measured on the device: a 1280px
 * screen with the rail parked off-canvas at x=-233..10. That parked position is
 * what made the bug — a rail link sits closer to the centre of a left-aligned
 * control than the page content does, so plain geometry sent focus into the
 * menu on every downward press.
 */
function place(el: HTMLElement, x: number, y: number, w = 160, h = 40) {
  el.style.opacity = "1"; // jsdom computes "" otherwise, which reads as hidden
  el.scrollIntoView = () => {};
  el.getBoundingClientRect = () =>
    ({
      left: x, top: y, right: x + w, bottom: y + h,
      width: w, height: h, x, y, toJSON: () => ({}),
    }) as DOMRect;
  return el;
}

function press(keyCode: number) {
  const ev = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "Unidentified" });
  Object.defineProperty(ev, "keyCode", { get: () => keyCode });
  Object.defineProperty(ev, "which", { get: () => keyCode });
  document.dispatchEvent(ev);
  return ev;
}

const DOWN = 20, UP = 19, LEFT = 21, RIGHT = 22;

/** Rail links off-canvas on the left; page controls in the content column. */
function buildScreen() {
  document.body.innerHTML = "";

  const aside = document.createElement("aside");
  aside.setAttribute("data-focus-zone", "rail");
  place(aside, -233, 0, 243, 720);
  document.body.appendChild(aside);

  const railLinks = ["Home", "Search", "Movies", "Series"].map((name, i) => {
    const a = document.createElement("a");
    a.href = "#";
    a.textContent = name;
    place(a, -223, 127 + i * 35, 223, 30);
    aside.appendChild(a);
    return a;
  });

  /**
   * The rail slides in whenever focus enters it (Sidebar watches focusin), and
   * it is `fixed`, so it comes to rest *on top of* the content rather than
   * pushing it aside. Any test that focuses a rail link has to move it here
   * first — measuring the parked position with focus inside is a state the app
   * never actually holds, and it hides the case where crossing back out is
   * refused because every control now sits "behind" the focused link.
   */
  const revealRail = () => {
    place(aside, 0, 0, 243, 720);
    railLinks.forEach((a, i) => place(a, 10, 127 + i * 35, 223, 30));
  };

  const main = document.createElement("main");
  main.setAttribute("data-focus-zone", "main");
  place(main, 20, 0, 1260, 720);
  document.body.appendChild(main);

  // Back link top-left — the element the bug was reported from.
  const back = document.createElement("a");
  back.href = "#";
  back.textContent = "Back to Lobby";
  place(back, 40, 40, 150, 35);
  main.appendChild(back);

  // Full-width controls stacked down the page.
  const stack = ["shield", "source", "episode", "cast"].map((name, i) => {
    const b = document.createElement("button");
    b.setAttribute("aria-label", name);
    place(b, 40, 120 + i * 140, 1200, 120);
    main.appendChild(b);
    return b;
  });

  return { aside, main, railLinks, back, stack, revealRail };
}

/**
 * Started once for the whole file. Re-importing per test would attach another
 * keydown listener each time — every instance carries its own dedupe set — and
 * a single press would then walk focus several steps.
 */
async function startTvOnce() {
  Object.defineProperty(navigator, "userAgent", { value: "MovwayTV", configurable: true });
  const tv = await import("@/lib/tv");
  tv.initTvSupport();
}

const inRail = () => !!document.querySelector("aside")?.contains(document.activeElement);
const label = () =>
  document.activeElement?.getAttribute("aria-label") ??
  document.activeElement?.textContent ??
  "none";

let screen: ReturnType<typeof buildScreen>;

beforeAll(async () => {
  screen = buildScreen();
  await startTvOnce();
});

beforeEach(() => {
  screen = buildScreen();
  (document.activeElement as HTMLElement | null)?.blur?.();
});

describe("D-pad vertical movement", () => {
  it("never leaves the page for the rail, from the exact spot that used to", () => {
    // Costs at these coordinates: rail "Search" 764, page content 1605 — pure
    // geometry picks the rail, which is the reported bug.
    const back = [...document.querySelectorAll("main a")].find(
      (a) => a.textContent === "Back to Lobby"
    ) as HTMLElement;
    back.focus();
    expect(document.activeElement?.textContent).toBe("Back to Lobby");

    press(DOWN);

    expect(inRail(), `focus went to the rail: ${label()}`).toBe(false);
    expect(label()).toBe("shield");
  });

  it("walks the whole page from top to bottom", () => {
    const back = [...document.querySelectorAll("main a")].find(
      (a) => a.textContent === "Back to Lobby"
    ) as HTMLElement;
    back.focus();

    const seen: string[] = [];
    for (let i = 0; i < 4; i++) {
      press(DOWN);
      seen.push(label());
    }

    expect(seen).toEqual(["shield", "source", "episode", "cast"]);
    expect(inRail()).toBe(false);
  });

  it("stops at the end of the page rather than escaping sideways", () => {
    const { stack } = { stack: [...document.querySelectorAll("main button")] as HTMLElement[] };
    stack[stack.length - 1].focus();

    press(DOWN);

    expect(label()).toBe("cast");
    expect(inRail()).toBe(false);
  });

  it("does not reach the rail going up either", () => {
    const shield = document.querySelector<HTMLElement>('[aria-label="shield"]')!;
    shield.focus();

    press(UP);

    expect(inRail()).toBe(false);
  });

  it("keeps the rail's own up/down inside the rail", () => {
    screen.revealRail();
    const rail = [...document.querySelectorAll("aside a")] as HTMLElement[];
    rail[0].focus();

    press(DOWN);

    expect(inRail()).toBe(true);
    expect(label()).toBe("Search");
  });
});

describe("D-pad horizontal movement", () => {
  it("enters the rail on left, which is the only way in", () => {
    document.querySelector<HTMLElement>('[aria-label="shield"]')!.focus();

    press(LEFT);

    expect(inRail(), `expected the rail, got ${label()}`).toBe(true);
  });

  it("returns to the page on right, with the rail where it actually sits", () => {
    // Revealed, the rail overlays the content: its right edge (243) is far to
    // the right of where main's controls begin (40). Deciding the crossing
    // from element geometry refuses every one of them and the remote sticks.
    screen.revealRail();
    const rail = [...document.querySelectorAll("aside a")] as HTMLElement[];
    rail[1].focus();

    press(RIGHT);

    expect(inRail(), `stuck in the rail on ${label()}`).toBe(false);
  });

  it("comes out of the rail beside what it was pointing at", () => {
    screen.revealRail();
    const rail = [...document.querySelectorAll("aside a")] as HTMLElement[];
    const from = rail[3];
    from.focus();

    press(RIGHT);

    expect(inRail()).toBe(false);

    // Whatever it lands on should be the page control nearest on the vertical,
    // so leaving the menu keeps your place rather than jumping to the top.
    const centre = (el: Element) => {
      const r = el.getBoundingClientRect();
      return (r.top + r.bottom) / 2;
    };
    const fromCentre = centre(from);
    const nearest = ([...document.querySelectorAll("main a, main button")] as HTMLElement[]).sort(
      (a, b) => Math.abs(centre(a) - fromCentre) - Math.abs(centre(b) - fromCentre)
    )[0];

    expect(document.activeElement).toBe(nearest);
  });
});

describe("keys the walker refuses", () => {
  it("still consumes the press at the end of a page", () => {
    const stack = [...document.querySelectorAll("main button")] as HTMLElement[];
    stack[stack.length - 1].focus();

    const ev = press(DOWN);

    // Letting a refused arrow through hands it to the WebView's own DOM-order
    // focus walker, which knows nothing about zones — so the edge of a page
    // would fling focus into the menu, undoing the whole fix.
    expect(ev.defaultPrevented).toBe(true);
  });

  it("consumes it at the top of a page too", () => {
    const back = [...document.querySelectorAll("main a")].find(
      (a) => a.textContent === "Back to Lobby"
    ) as HTMLElement;
    back.focus();

    expect(press(UP).defaultPrevented).toBe(true);
  });
});

describe("seeding focus when nothing has it", () => {
  it("skips elements that cannot take focus, such as the mobile menu on TV", async () => {
    const tv = await import("@/lib/tv");

    // AppLayout's hamburger is first in <main> but lives in a md:hidden
    // wrapper, so on a TV it is display:none and .focus() does nothing.
    const hidden = document.createElement("button");
    hidden.setAttribute("aria-label", "menu");
    hidden.style.display = "none";
    screen.main.prepend(hidden);

    (document.activeElement as HTMLElement | null)?.blur?.();
    tv.seedFocusSoon(0);
    await new Promise((r) => setTimeout(r, 20));

    expect(document.activeElement).not.toBe(hidden);
    expect(document.activeElement).not.toBe(document.body);
    expect(inRail()).toBe(false);
  });
});

/**
 * The glass navigation bar pinned to the top of the screen. It is `fixed`, so
 * it stays at y≈24 however far the page has scrolled — which means, by plain
 * geometry, it is "above" every control on screen and closer than a row that
 * has scrolled out of view. Only the first row of a page may step into it.
 */
describe("D-pad and the top navigation bar", () => {
  let nav: HTMLElement;
  let navLinks: HTMLElement[];
  let rows: HTMLElement[];

  beforeEach(() => {
    document.body.innerHTML = "";

    nav = document.createElement("nav");
    nav.setAttribute("data-focus-zone", "nav");
    nav.setAttribute("data-focus-edge", "top");
    place(nav, 860, 24, 530, 54);
    document.body.appendChild(nav);
    navLinks = ["Home", "Movies", "Series", "Search"].map((name, i) => {
      const a = document.createElement("a");
      a.href = "#";
      a.textContent = name;
      place(a, 870 + i * 125, 30, 110, 42);
      nav.appendChild(a);
      return a;
    });

    const main = document.createElement("main");
    main.setAttribute("data-focus-zone", "main");
    place(main, 0, 0, 1280, 720);
    document.body.appendChild(main);
    // Scrolled mid-page: the row above the first one on screen is off the top.
    rows = ["row-offscreen", "row-a", "row-b"].map((name, i) => {
      const b = document.createElement("button");
      b.setAttribute("aria-label", name);
      place(b, 64, -260 + i * 330, 200, 300);
      main.appendChild(b);
      return b;
    });
  });

  const inNav = () => nav.contains(document.activeElement);

  it("moves up a row mid-page rather than jumping into the bar", () => {
    rows[1].focus();

    press(UP);

    expect(inNav(), `jumped into the bar from mid-page`).toBe(false);
    expect(label()).toBe("row-offscreen");
  });

  it("enters the bar on up from the first row of the page", () => {
    // Scrolled back to the top, as revealing the first row leaves it.
    rows.forEach((r, i) => place(r, 64, 120 + i * 330, 200, 300));
    rows[0].focus();

    press(UP);

    expect(inNav(), `expected the bar, got ${label()}`).toBe(true);
  });

  it("opens the bar on the section you are in", () => {
    rows.forEach((r, i) => place(r, 64, 120 + i * 330, 200, 300));
    navLinks[2].setAttribute("aria-current", "page");
    rows[0].focus();

    press(UP);

    expect(label()).toBe("Series");
  });

  it("returns to the page on down", () => {
    navLinks[1].focus();

    press(DOWN);

    expect(inNav()).toBe(false);
    expect(document.activeElement?.closest("main")).not.toBeNull();
  });

  it("returns down to the page's landing control when it is on screen", () => {
    rows.forEach((r, i) => place(r, 64 + i * 400, 120, 200, 300));
    rows[0].setAttribute("data-tv-autofocus", "");
    navLinks[2].focus(); // far to the right of the landing control

    press(DOWN);

    expect(label()).toBe("row-offscreen");
  });

  it("keeps left and right inside the bar, and walls them at its ends", () => {
    navLinks[0].focus();

    press(RIGHT);
    expect(label()).toBe("Movies");

    navLinks[0].focus();
    const ev = press(LEFT);
    expect(label()).toBe("Home");
    expect(ev.defaultPrevented).toBe(true);
  });

  it("never enters the bar sideways from the page", () => {
    rows[1].focus();

    press(RIGHT);

    expect(inNav()).toBe(false);
  });

  it("is never where focus is seeded", async () => {
    const tv = await import("@/lib/tv");
    rows.forEach((r) => r.remove());
    (document.activeElement as HTMLElement | null)?.blur?.();

    expect(tv.focusFirstInMain()).toBe(false);
    expect(inNav()).toBe(false);
  });
});
