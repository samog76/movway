/**
 * Why a request failed, in words.
 *
 * There is no console on a television. When the app is sideloaded onto a TV and
 * the shelves come up empty, the only thing the viewer can see is whatever the
 * page chooses to print — so print the part that identifies the cause. A dead
 * network, a rejected key and a throttled key all render as an empty shelf
 * otherwise, and they need completely different fixes.
 */

const TMDB_HOST = "api.themoviedb.org";

export interface Fault {
  cause: string;
  detail: string;
  hint: string;
}

export function describeFault(error: unknown): Fault {
  const message = error instanceof Error ? error.message : String(error ?? "unknown error");
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;

  // fetch() rejects with a TypeError for anything below HTTP: DNS, TLS, no
  // route. The wording differs per engine, hence the spread of matches.
  const isNetwork = /failed to fetch|load failed|networkerror|network request failed/i.test(
    message
  );

  if (offline) {
    return {
      cause: "This device is offline",
      detail: message,
      hint: "Android reports no network connection. Reconnect the TV to Wi-Fi and reopen Movway.",
    };
  }

  if (isNetwork) {
    return {
      cause: `Cannot reach ${TMDB_HOST}`,
      detail: message,
      hint:
        "The request never completed, so this is the connection rather than the app. Check the TV can browse the web, that its date and time are correct — a wrong clock makes every HTTPS request fail — and that the network does not block TMDB.",
    };
  }

  const status = message.match(/TMDB (\d{3})/)?.[1];
  if (status === "401") {
    return {
      cause: "TMDB rejected the API key",
      detail: message,
      hint: "Set VITE_TMDB_API_KEY to a valid key and rebuild.",
    };
  }
  if (status === "429") {
    return {
      cause: "TMDB is rate limiting this key",
      detail: message,
      hint: "Too many requests from this key. Wait a minute, then reopen Movway.",
    };
  }
  if (status) {
    return {
      cause: `TMDB returned ${status}`,
      detail: message,
      hint: "The service answered with an error. If it persists, TMDB may be down.",
    };
  }

  return {
    cause: "Could not load from TMDB",
    detail: message,
    hint: "An unexpected error. The detail line above is the raw message.",
  };
}
