/**
 * Google TV / Android TV support.
 *
 * A WebView on a TV gets D-pad presses as arrow keys and moves focus with
 * Chromium's built-in sequential navigation, which follows DOM order. That
 * falls apart on a poster wall: the row's scroll buttons come before the rail
 * in the DOM, so the remote lands on them and never reaches the posters, and
 * anything scrolled outside a horizontal container is effectively unreachable.
 *
 * So we do what every good TV app does and navigate *geometrically*: on each
 * arrow press, find the nearest focusable element in that direction and move
 * there ourselves. That is what makes YouTube on a TV feel like it does.
 */

/** Appended to the user agent by the native shell (see capacitor.config.ts). */
const TV_UA_MARKER = "MovwayTV";

export function isTvDevice(): boolean {
  if (typeof navigator === "undefined") return false;

  // ?tv=1 forces TV mode in a desktop browser, which is the only practical way
  // to work on this without a TV in front of you.
  if (typeof location !== "undefined" && /[?&]tv=1\b/.test(location.search)) return true;

  // The packaged app IS the Google TV build, so it does not sniff for a TV —
  // it just is one. Sniffing was a single point of failure: if the user agent
  // came through unmarked for any reason, every TV behaviour silently stayed
  // off and the app was unusable with a remote. Sideloading this build onto a
  // phone gets the 10-foot layout, which is a fair trade for never shipping a
  // dead remote again.
  if (import.meta.env.VITE_NATIVE) return true;

  const ua = navigator.userAgent;
  return (
    ua.includes(TV_UA_MARKER) ||
    /\bGoogle TV\b|\bAndroid TV\b|\bAFT[A-Z]|\bBRAVIA\b|\bSHIELD Android TV\b|\bCrKey\b/i.test(ua)
  );
}

// ── Focus candidates ─────────────────────────────────────────────────────────

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

type Direction = "up" | "down" | "left" | "right";

interface Candidate {
  el: HTMLElement;
  rect: DOMRect;
  zone: string;
}

/**
 * Off-screen is fine — an element parked outside its row's scroll port is
 * exactly what we want to be able to move into. Only genuinely unrenderable
 * elements are excluded.
 */
function isReachable(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect();
  if (rect.width < 2 || rect.height < 2) return false;
  const style = getComputedStyle(el);
  if (style.visibility === "hidden" || style.display === "none") return false;
  // Controls that only appear on focus (a card's remove button) are painted at
  // zero opacity until then; taking focus while invisible looks like the
  // remote has died.
  if (Number(style.opacity) === 0) return false;
  if (el.hasAttribute("hidden") || el.getAttribute("aria-hidden") === "true") return false;
  return true;
}

/**
 * Focus zones.
 *
 * A TV app is not one flat plane of controls: the left rail and the content
 * are separate columns, and every set-top interface worth copying treats them
 * that way. Pressing down in a page moves down *that page* — it never slides
 * sideways into the menu — and the menu is something you step into on purpose
 * by pressing left, then step out of by pressing right.
 *
 * Without that split the geometry alone decides, and the geometry is wrong
 * here: the rail is parked off-canvas near x=-233, so on a 1280px screen a rail
 * link sits far closer to the *centre* of a left-aligned control than the page
 * content does. Moving down from "Back to Lobby" cost 764 to reach the rail and
 * 1605 to reach the player below it, so focus left the page and walked the menu
 * instead — which is exactly the bug this fixes.
 */
function zoneOf(el: HTMLElement): string {
  return el.closest("[data-focus-zone]")?.getAttribute("data-focus-zone") ?? "main";
}

/**
 * Rect of each zone's container. Crossing between zones has to be decided from
 * these rather than from the two elements, because the rail is `fixed` and
 * slides *over* the content rather than pushing it aside: once it is revealed a
 * rail link's right edge sits well to the right of where the page's controls
 * start, so element-level geometry claims the content is "behind" you and every
 * crossing is refused. The containers still say plainly which side is which.
 */
function zoneRects(): Map<string, DOMRect> {
  const map = new Map<string, DOMRect>();
  for (const el of document.querySelectorAll<HTMLElement>("[data-focus-zone]")) {
    const name = el.getAttribute("data-focus-zone");
    if (name && !map.has(name)) map.set(name, el.getBoundingClientRect());
  }
  return map;
}

function candidates(): Candidate[] {
  const found: Candidate[] = [];
  for (const el of document.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)) {
    if (isReachable(el)) {
      found.push({ el, rect: el.getBoundingClientRect(), zone: zoneOf(el) });
    }
  }
  return found;
}

/**
 * Cost of travelling from `from` to `to`. Distance along the direction of
 * travel plus a heavy penalty for drifting off-axis, so moving right along a
 * row stays in that row instead of diving into the one below.
 */
function cost(
  from: DOMRect,
  to: DOMRect,
  dir: Direction,
  /** Require left/right to stay on the same visual row. */
  sameRowOnly: boolean
): number | null {
  // A little slack so items that overlap by a pixel still count as "ahead".
  const SLACK = 8;
  const OFF_AXIS_WEIGHT = 3;

  let ahead: number;
  let offAxis: number;

  if (dir === "right" || dir === "left") {
    // Prefer staying on the current row, so running along a rail never drops
    // into the one below. This is only the first pass though: applied
    // absolutely it strands you in the sidebar, where nothing in the content
    // area lines up with a nav item.
    if (sameRowOnly) {
      const overlap = Math.min(from.bottom, to.bottom) - Math.max(from.top, to.top);
      if (overlap < Math.min(from.height, to.height) * 0.5) return null;
    }

    ahead = dir === "right" ? to.left - from.right : from.left - to.right;
    offAxis = Math.abs((to.top + to.bottom) / 2 - (from.top + from.bottom) / 2);
  } else {
    ahead = dir === "down" ? to.top - from.bottom : from.top - to.bottom;
    offAxis = Math.abs((to.left + to.right) / 2 - (from.left + from.right) / 2);
  }

  if (ahead < -SLACK) return null; // behind us — wrong way
  return Math.max(ahead, 0) + offAxis * OFF_AXIS_WEIGHT;
}

// ── Movement ─────────────────────────────────────────────────────────────────

let lastMoveAt = 0;

/**
 * Reveal the newly focused element. Holding the D-pad fires keys faster than a
 * smooth scroll can settle, so once presses come in quickly we snap instead —
 * the animation is what makes fast scrolling feel laggy, not the focus change.
 */
function reveal(el: HTMLElement) {
  const now = performance.now();
  const rapid = now - lastMoveAt < 250;
  lastMoveAt = now;

  el.focus({ preventScroll: true });
  el.scrollIntoView({
    behavior: rapid ? "auto" : "smooth",
    block: "center",
    inline: "center",
  });
}

function move(dir: Direction): boolean {
  const all = candidates();
  if (all.length === 0) return false;

  const active = document.activeElement as HTMLElement | null;
  if (!active || active === document.body || !isReachable(active)) {
    // Seed into the content, never the menu: landing in a rail that is parked
    // off-screen looks like the remote has died.
    reveal((all.find((c) => c.zone === "main") ?? all[0]).el);
    return true;
  }

  const from = active.getBoundingClientRect();
  const fromZone = zoneOf(active);

  const pick = (sameRowOnly: boolean, sameZoneOnly: boolean): HTMLElement | null => {
    let best: HTMLElement | null = null;
    let bestCost = Infinity;
    for (const { el, rect, zone } of all) {
      if (el === active) continue;
      if (sameZoneOnly && zone !== fromZone) continue;
      const c = cost(from, rect, dir, sameRowOnly);
      if (c === null || c >= bestCost) continue;
      bestCost = c;
      best = el;
    }
    return best;
  };

  // Up and down stay inside the zone, full stop. Running out of page is a real
  // answer — it means you are at the end of it — and is far better than being
  // thrown into the menu mid-scroll.
  if (dir === "up" || dir === "down") {
    const target = pick(false, true);
    if (!target) return false;
    reveal(target);
    return true;
  }

  /**
   * Stepping between zones. Which zone lies which way is settled by the
   * containers; the element chosen inside it is simply the one nearest on the
   * vertical, so you come out of the menu beside whatever you were pointing at.
   */
  const crossZone = (): HTMLElement | null => {
    const rects = zoneRects();
    const here = rects.get(fromZone);
    if (!here) return null;
    const hereCentre = (here.left + here.right) / 2;

    let best: HTMLElement | null = null;
    let bestCost = Infinity;
    for (const { el, rect, zone } of all) {
      if (zone === fromZone) continue;
      const there = rects.get(zone);
      if (!there) continue;
      const thereCentre = (there.left + there.right) / 2;
      if (dir === "left" ? thereCentre >= hereCentre : thereCentre <= hereCentre) continue;

      const c = Math.abs((rect.top + rect.bottom) / 2 - (from.top + from.bottom) / 2);
      if (c >= bestCost) continue;
      bestCost = c;
      best = el;
    }
    return best;
  };

  // Left and right prefer the current zone, then cross. That crossing is the
  // only way in and out of the rail, which is what makes it feel deliberate.
  const target = pick(true, true) ?? pick(false, true) ?? crossZone();
  if (!target) return false;
  reveal(target);
  return true;
}

const DIRECTIONS: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  // Some WebViews report the pre-standard names.
  Up: "up",
  Down: "down",
  Left: "left",
  Right: "right",
};

/**
 * Android delivers the D-pad as KEYCODE_DPAD_* (19–22), and a good number of
 * TV WebView builds surface those with `key` set to "Unidentified" rather than
 * "ArrowUp". Matching on `key` alone therefore does nothing on exactly the
 * hardware this is written for: the handler bails and Chromium's DOM-order
 * focus takes over, which reaches a few buttons and never the posters.
 */
const KEY_CODES: Record<number, Direction> = {
  38: "up",
  40: "down",
  37: "left",
  39: "right",
  19: "up", // KEYCODE_DPAD_UP
  20: "down", // KEYCODE_DPAD_DOWN
  21: "left", // KEYCODE_DPAD_LEFT
  22: "right", // KEYCODE_DPAD_RIGHT
};

/** KEYCODE_DPAD_CENTER / KEYCODE_ENTER / KEYCODE_NUMPAD_ENTER. */
const SELECT_CODES = new Set([23, 66, 160]);

function directionOf(event: KeyboardEvent): Direction | null {
  return DIRECTIONS[event.key] ?? KEY_CODES[event.keyCode || event.which] ?? null;
}

/** Last key seen, surfaced in the rail on TV so a dead remote is diagnosable. */
function recordKey(event: KeyboardEvent, handled: boolean) {
  const readout = document.getElementById("tv-key-readout");
  if (!readout) return;
  const name = event.key && event.key !== "Unidentified" ? event.key : `#${event.keyCode}`;
  readout.textContent = `${name}${handled ? "" : " ·skip"}`;
}

/** The same event reaches both listeners below; act on it once. */
const seen = new WeakSet<KeyboardEvent>();

function onKeyDown(event: KeyboardEvent) {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  if (seen.has(event)) return;
  seen.add(event);

  const active = document.activeElement as HTMLElement | null;

  // D-pad centre does not always arrive as Enter, which leaves the remote able
  // to move but not to choose anything.
  if (SELECT_CODES.has(event.keyCode || event.which) && event.key !== "Enter") {
    if (
      active &&
      active !== document.body &&
      active.tagName !== "SELECT" &&
      active.matches(FOCUSABLE_SELECTOR)
    ) {
      recordKey(event, true);
      event.preventDefault();
      active.click();
      return;
    }
  }

  const dir = directionOf(event);
  if (!dir) {
    recordKey(event, false);
    return;
  }

  const tag = active?.tagName;

  // A select claims no arrows at all. Giving it any left the remote stuck on
  // the Source dropdown — the native element eats the key to change option and
  // never yields focus, so no press could leave it, and the player sitting just
  // above became unreachable. Selection happens through the WebView's own
  // option picker on OK (handled above), which the remote drives natively,
  // so the walker is free to own every direction here.
  //
  // A caret still owns horizontal keys in a text field; vertical walks out.
  if (tag === "TEXTAREA") return;
  if (tag === "INPUT") {
    const type = (active as HTMLInputElement).type;
    const textLike = !["checkbox", "radio", "button", "submit", "range"].includes(type);
    if (textLike && (dir === "left" || dir === "right")) return;
    if (type === "range") return;
  }

  const moved = move(dir);
  recordKey(event, moved);

  // Always consume the key, even when nothing moved. Letting a refused press
  // through hands it to Chromium's DOM-order focus navigation — the very
  // behaviour this walker exists to replace — and that ignores zones entirely,
  // so reaching the end of a page would fling focus into the menu. Refusing to
  // move *is* the answer at an edge; it should feel like a wall, not a trapdoor.
  event.preventDefault();
}

// ── Focus seeding ────────────────────────────────────────────────────────────

/** Something must always be focused, or the remote appears dead. */
function seedFocus() {
  const active = document.activeElement;
  if (active && active !== document.body && isReachable(active as HTMLElement)) return;

  // Reachability matters as much here as it does when moving. Picking by
  // selector alone lands on the first focusable in <main>, which is the mobile
  // menu button — inside a `md:hidden` wrapper, so `display: none` at every TV
  // width. Focusing it does nothing at all, activeElement stays on the body,
  // and the screen comes up with no highlight anywhere: the dead-remote
  // symptom this is supposed to prevent.
  focusFirstInMain();
}

/**
 * Move the remote to the first control in the content area that can actually
 * take focus, and report whether anything did.
 *
 * Selecting by CSS alone is not enough: the first focusable inside <main> is
 * the mobile menu button, which lives in a `md:hidden` wrapper and is therefore
 * `display: none` at every TV width. Focusing it does nothing, activeElement
 * stays on the body, and the screen comes up with no highlight anywhere.
 */
export function focusFirstInMain(): boolean {
  const usable = candidates();
  const target =
    usable.find((c) => c.zone === "main") ??
    usable.find((c) => c.zone !== "rail") ??
    usable[0];
  target?.el.focus({ preventScroll: true });
  return !!target;
}

/**
 * Keeps focus visible for pointer/keyboard users too. Cheap, and it means a
 * focused card is never left flush against an edge.
 */
function onFocusIn(event: FocusEvent) {
  const el = event.target as HTMLElement | null;
  if (!el?.matches?.(FOCUSABLE_SELECTOR)) return;
  // reveal() already positioned this one; scrolling again would fight it.
  if (performance.now() - lastMoveAt < 80) return;
  el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
}

/**
 * Re-seed after a route change. A client-side navigation tears out the element
 * the remote was on, leaving document.body focused and nothing highlighted on
 * screen — which reads as a dead remote until the next press happens to revive
 * it. Every TV interface keeps something focused at all times; this is that.
 *
 * The delay lets the incoming route paint before we look for a target.
 */
export function seedFocusSoon(delay = 250): void {
  if (typeof window === "undefined" || !isTvDevice()) return;
  window.setTimeout(seedFocus, delay);
}

let started = false;

/** Idempotent — safe to call more than once. */
export function initTvSupport(): void {
  if (started || typeof document === "undefined") return;
  started = true;

  if (!isTvDevice()) {
    document.addEventListener("focusin", onFocusIn);
    return;
  }

  document.documentElement.classList.add("tv");

  // Capture phase on both targets: some WebView builds deliver key events to
  // the window rather than the document, and a missed listener here is the
  // difference between a working remote and a dead one.
  document.addEventListener("keydown", onKeyDown, true);
  window.addEventListener("keydown", onKeyDown, true);

  // Safety net: if anything else ends up moving focus, at least reveal it.
  document.addEventListener("focusin", onFocusIn);

  const seedSoon = () => window.setTimeout(seedFocus, 350);
  seedSoon();
  window.addEventListener("popstate", seedSoon);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) seedSoon();
  });
}
