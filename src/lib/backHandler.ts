/**
 * Where the remote's Back button goes.
 *
 * Android delivers Back to the Activity, not the page, so nothing in the web
 * layer sees it unless a plugin forwards it — and with no plugin installed the
 * Activity's default ran, which finishes the app. That is why Back closed
 * Movway from every screen instead of stepping back through it.
 *
 * Now @capacitor/app forwards the press and this chain decides what it means.
 * Surfaces that are "inside" something — the player with the remote handed to
 * it, and anything similar later — register an interceptor and claim the press
 * before it becomes navigation. Whatever registered most recently is asked
 * first, so the innermost thing on screen is what Back closes.
 */
type BackInterceptor = () => boolean;

const interceptors: BackInterceptor[] = [];

/** Returns an unregister function; call it on unmount. */
export function registerBackInterceptor(fn: BackInterceptor): () => void {
  interceptors.unshift(fn);
  return () => {
    const at = interceptors.indexOf(fn);
    if (at >= 0) interceptors.splice(at, 1);
  };
}

/** True when something claimed the press and navigation should not happen. */
export function runBackInterceptors(): boolean {
  // Copy first: an interceptor may unregister itself while handling.
  for (const fn of [...interceptors]) {
    try {
      if (fn()) return true;
    } catch {
      // A broken interceptor must not swallow the press and wedge Back.
    }
  }
  return false;
}

/** Test seam. */
export function clearBackInterceptors(): void {
  interceptors.length = 0;
}
