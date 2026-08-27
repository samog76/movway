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
