import { useEffect, useRef } from "react";
import { useLocation, useNavigate, useNavigationType } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { runBackInterceptors, setRouterBackHandlerReady } from "@/lib/backHandler";

/**
 * Gives the hardware Back button the behaviour a TV viewer expects: step back
 * through the app, and only leave from the top. Renders nothing.
 *
 * Registering a `backButton` listener also switches off the plugin's own
 * fallback, so this is the single place that decides — no double handling.
 *
 * Back walks a stack this component keeps, rather than calling history.go(-1).
 * The watch screen embeds a third-party player in a cross-origin iframe, and a
 * sub-frame's own navigations land in the same joint session history as the
 * app's. Stepping back through that history can therefore rewind the *player*
 * while the app stands still, which looks exactly like a dead Back button. A
 * stack of our own routes cannot be polluted by the frame, and navigating with
 * `replace` keeps the history from growing underneath us.
 */
export default function NativeBackButton() {
  const navigate = useNavigate();
  const location = useLocation();
  const navigationType = useNavigationType();

  /** Full locations, so a query string survives the trip back. */
  const here = location.pathname + location.search;
  const stackRef = useRef<string[]>([here]);

  // Everything the listener reads goes through a ref. `useNavigate` returns a
  // fresh function whenever the location changes, so depending on it would tear
  // the listener down and re-add it on every navigation — losing any press that
  // landed in the gap.
  const pathRef = useRef(here);
  pathRef.current = here;

  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  useEffect(() => {
    const stack = stackRef.current;
    // Going back rewrites the stack first, so the new route is already on top
    // and this correctly records nothing.
    if (stack[stack.length - 1] === here) return;

    // A replace is the same screen changing its mind — the search box updating
    // its query, say — not somewhere new. Pushing those would make Back replay
    // the viewer's typing one keystroke at a time.
    if (navigationType === "REPLACE" && stack.length > 0) stack[stack.length - 1] = here;
    else stack.push(here);
  }, [here, navigationType]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let remove: (() => void) | undefined;
    let cancelled = false;

    void App.addListener("backButton", () => {
      // Something on screen wants this press more than the router does.
      if (runBackInterceptors()) return;

      const stack = stackRef.current;
      if (stack.length > 1) {
        stack.pop();
        navigateRef.current(stack[stack.length - 1], { replace: true });
        return;
      }

      // Opened straight onto an inner screen (a deep link, or a restored
      // session): send them home rather than out of the app.
      if (pathRef.current !== "/") {
        stackRef.current = ["/"];
        navigateRef.current("/", { replace: true });
        return;
      }

      void App.exitApp();
    }).then((handle) => {
      if (cancelled) {
        void handle.remove();
        return;
      }
      remove = () => void handle.remove();
      setRouterBackHandlerReady(true);
    });

    return () => {
      cancelled = true;
      setRouterBackHandlerReady(false);
      remove?.();
    };
    // Attached once for the life of the component — see the refs above.
  }, []);

  return null;
}
