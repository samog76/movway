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

function candidates(): Candidate[] {
  const found: Candidate[] = [];
  for (const el of document.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)) {
    if (isReachable(el)) found.push({ el, rect: el.getBoundingClientRect() });
  }
  return found;
}

/**
 * Cost of travelling from `from` to `to`. Distance along the direction of
 * travel plus a heavy penalty for drifting off-axis, so moving right along a
 * row stays in that row instead of diving into the one below.
 */
function cost(from: DOMRect, to: DOMRect, dir: Direction): number | null {
  // A little slack so items that overlap by a pixel still count as "ahead".
  const SLACK = 8;
  const OFF_AXIS_WEIGHT = 3;

  let ahead: number;
  let offAxis: number;

  if (dir === "right" || dir === "left") {
    // Left/right must stay in the current row. Without this, running off the
    // end of a short rail throws focus into whatever sits further right on a
    // different row, which reads as the remote jumping at random.
    const overlap = Math.min(from.bottom, to.bottom) - Math.max(from.top, to.top);
    if (overlap < Math.min(from.height, to.height) * 0.5) return null;

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
    reveal(all[0].el);
    return true;
  }

  const from = active.getBoundingClientRect();
  let best: HTMLElement | null = null;
  let bestCost = Infinity;

  for (const { el, rect } of all) {
    if (el === active) continue;
    const c = cost(from, rect, dir);
    if (c === null || c >= bestCost) continue;
    bestCost = c;
    best = el;
  }

  if (!best) return false;
  reveal(best);
  return true;
}

const DIRECTIONS: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

function onKeyDown(event: KeyboardEvent) {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  const dir = DIRECTIONS[event.key];
  if (!dir) return;

  const active = document.activeElement as HTMLElement | null;
  const tag = active?.tagName;

  // Native controls own the arrows they actually use: a select opens its list,
  // and a caret moves along text. Vertical keys still walk out of a text field.
  if (tag === "SELECT") return;
  if (tag === "TEXTAREA") return;
  if (tag === "INPUT") {
    const type = (active as HTMLInputElement).type;
    const textLike = !["checkbox", "radio", "button", "submit", "range"].includes(type);
    if (textLike && (dir === "left" || dir === "right")) return;
    if (type === "range") return;
  }

  if (move(dir)) event.preventDefault();
}

// ── Focus seeding ────────────────────────────────────────────────────────────

/** Something must always be focused, or the remote appears dead. */
function seedFocus() {
  const active = document.activeElement;
  if (active && active !== document.body && isReachable(active as HTMLElement)) return;
  const first = document.querySelector<HTMLElement>(
    `main ${FOCUSABLE_SELECTOR.split(",").join(", main ")}`
  );
  (first ?? document.querySelector<HTMLElement>(FOCUSABLE_SELECTOR))?.focus({
    preventScroll: true,
  });
}

/**
 * Keeps focus visible for pointer/keyboard users too. Cheap, and it means a
 * focused card is never left flush against an edge.
 */
function onFocusIn(event: FocusEvent) {
  const el = event.target as HTMLElement | null;
  if (!el?.matches?.(FOCUSABLE_SELECTOR)) return;
  el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
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

  // Spatial navigation replaces focusin scrolling entirely on a TV; running
  // both would fight over the scroll position.
  document.addEventListener("keydown", onKeyDown, true);

  const seedSoon = () => window.setTimeout(seedFocus, 350);
  seedSoon();
  window.addEventListener("popstate", seedSoon);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) seedSoon();
  });
}
