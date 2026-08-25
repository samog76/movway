/**
 * Google TV / Android TV support.
 *
 * On a TV there is no pointer: the user drives the UI with a D-pad, so the
 * focused element *is* the cursor. Three things have to be true for that to
 * feel right, and none of them come for free in a WebView:
 *
 *   1. The app knows it is on a TV (so 10-foot styling can kick in).
 *   2. Whatever gains focus is scrolled somewhere comfortable to look at,
 *      never pinned against a screen edge.
 *   3. Focus never escapes into the void — there is always something focused.
 */

/** Set by the native shell via Capacitor's appendUserAgent. */
const TV_UA_MARKER = "MovwayTV";

export function isTvDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return (
    ua.includes(TV_UA_MARKER) ||
    // Fall back to platform hints when the app runs in a plain TV browser.
    /\bGoogle TV\b|\bAndroid TV\b|\bAFT[A-Z]|\bBRAVIA\b|\bSHIELD Android TV\b/i.test(ua)
  );
}

/**
 * Keeps the focused element in a comfortable part of the screen. `nearest`
 * vertically avoids yanking the page around; `center` horizontally means a
 * focused poster lands mid-row instead of half off-screen.
 */
function handleFocusIn(event: FocusEvent) {
  const el = event.target as HTMLElement | null;
  if (!el || typeof el.scrollIntoView !== "function") return;
  // Ignore focus on the document body / non-interactive containers.
  if (!el.matches("a, button, input, select, textarea, [tabindex]")) return;

  el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
}

/**
 * The D-pad "back" button arrives as a browser back navigation on Android TV,
 * which react-router already handles. What it does not handle is landing on a
 * page with nothing focused, leaving the remote dead. Re-seed focus on route
 * changes and after the first paint.
 */
function seedFocus() {
  const active = document.activeElement;
  if (active && active !== document.body) return;
  const first = document.querySelector<HTMLElement>(
    "main a[href], main button:not([disabled]), main input, main select"
  );
  first?.focus({ preventScroll: true });
}

let started = false;

/** Idempotent — safe to call from module scope and again on navigation. */
export function initTvSupport(): void {
  if (started || typeof document === "undefined") return;
  started = true;

  if (isTvDevice()) {
    document.documentElement.classList.add("tv");
  }

  // Focus scrolling helps mouse+keyboard users too, so it is not TV-gated.
  document.addEventListener("focusin", handleFocusIn);

  if (isTvDevice()) {
    window.setTimeout(seedFocus, 400);
    window.addEventListener("popstate", () => window.setTimeout(seedFocus, 300));
  }
}
