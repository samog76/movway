# Movway — handover

Everything a fresh session needs to pick this up: what the app is, what was built,
what was proven impossible and why, and where the work stands.

**State:** v1.5.1 · versionCode 14 · 63 tests passing · `main` @ c217628

---

## 1. What Movway is

A React app (Vite + TypeScript + Tailwind) that browses movies and TV using TMDB for
metadata and plays them from third-party sources. It ships two ways: a web build, and a
**Capacitor-packaged Android APK aimed at Google TV**, sideloaded to a television and
driven with a remote.

The TV build is the one that matters. Almost every hard problem in this project comes from
that context: a D-pad instead of a pointer, a WebView instead of a browser, and a ten-foot
interface instead of a desktop one.

The interface has a deliberate visual identity — film-black ground, marquee-lime accent,
Bricolage Grotesque over Manrope with JetBrains Mono for data. That design is settled and
shouldn't be re-litigated without reason.

---

## 2. Feature state at a glance

| Area | State | Notes |
|---|---|---|
| Browsing & search | **works** | Home, Browse, Search, watch page with episode picker and cast. Search keeps its query in the URL so Back returns to results. |
| D-pad navigation | **works** | Geometric focus walker with zones. Focus lands on the player on arrival. |
| Back button | **works** | Steps back through the app; exits only from the first screen. |
| Native player | **the only player** | Movway's own `<video>` + hls.js with working controls. Every title plays through it. |
| Embedded players | **removed** | VidLink and VidCore are gone — they could only ever show a picture, and falling back to one hid a broken backend. See §3. |
| Streaming backend | **must run at home** | CinePro Core behind a Cloudflare Tunnel. A cloud host returns nothing — the providers block datacenter IPs. See §4. |

---

## 3. Why the embeds are gone

The app originally played everything by embedding a third-party player in an `<iframe>`.
On a TV that fails at the most basic level: **you cannot pause with the remote.** Four
rounds went into trying to fix that inside the iframe before establishing it cannot be
fixed there at all. Those embeds have since been removed outright — the findings below are
why, and they are kept so nobody proposes bringing them back.

These are measured results, not assumptions. Re-testing them is wasted effort unless a
provider changes.

**REFUTED — the embed will accept play/pause commands.**
All five common postMessage dialects were sent to VidLink. Playback carried on unchanged
and it emitted no `pause` event. These players broadcast telemetry outward but accept
nothing inward.

**REFUTED — focusing the iframe will let the D-pad drive their player.**
Space and ArrowRight were dispatched at the embed's document, body and `<video>` element.
Neither playback state nor position moved: their player has no keyboard handling, so focus
delivery is irrelevant.

**REFUTED — the video can be mirrored into our own element.**
A cross-origin iframe cannot be drawn to a canvas, and `captureStream()` needs same-origin
access. CSS cropping can't help because their controls are painted over the video. None of
it would give control regardless.

**OUT OF BOUNDS — resolve the stream URL ourselves.**
The manifest is reachable but gated by a per-request token minted by a WebAssembly module
(`fu.wasm`) plus CloudFront signed cookies with an expiry. Getting at it means defeating a
deliberate access-control mechanism, so it was not built.

**CONFIRMED — a streaming backend returns the stream, and then everything works.**
With an OMSS backend, Movway plays the stream in its own `<video>`. Verified live: pause
took playback `false → true`, forward-a-minute moved `8.5s → 68.5s`, and the scrub bar
landed on exactly `300s` of a 635s title.

So: **the embed path gave a picture and nothing else.** Its on-screen chrome could change
source, change episode and go fullscreen, but not pause. The backend path is the only
arrangement where a remote controls playback, so it is now the only path there is.

Keeping the embeds as a fallback had a second cost, less obvious than the first: a backend
that was misconfigured, asleep or returning nothing still produced a picture, so it looked
like it worked. Testing the backend was impossible while the thing it failed over to was
indistinguishable from success. The watch page now names the fault instead — no backend
set, unreachable, an `OMSS 500`, or nothing playable for that title — because there is no
console on a television.

---

## 4. The streaming backend

Movway needs an OMSS backend ([docs.cinepro.cc](https://docs.cinepro.cc)) to play anything.
A **CinePro Core** instance is the one this project uses.

> **A cloud host does not work for this, and that is measured, not assumed.**
> CinePro's provider scrapers are blocked from datacenter IP ranges. The same commit, the
> same TMDB key and the same title were run from both, minutes apart:
>
> | Provider | Render (Frankfurt) | A home connection |
> |---|---|---|
> | VixSrc | 0 sources | **1 source** (hls 1080p, eng+ita audio) |
> | FshareTV | 0 sources | **3 sources** (mp4 720p ×2, 360p) |
> | The other 12 | 0 | 0 |
>
> VidSrc says so in its own diagnostic: *"Invalid or expired token. Note that VidSrc blocks
> all kinds of VPN IPs."* Everything from a datacenter returns `404 No streaming sources
> found`, which looks exactly like a broken deployment and is not one.

### The arrangement that works

Run CinePro on a machine at home and expose it over https with a Cloudflare Tunnel — a
residential IP, a real hostname, and no cold starts.

```bash
# On the home machine, in a checkout of github.com/samog76/core
npm install --include=dev && npm run build
HOST=0.0.0.0 PORT=8099 CACHE_TYPE=memory \
  TMDB_API_KEY=<the key that is also the fallback in src/lib/tmdb.ts> \
  node dist/server.js

# In a second shell — prints the https URL to put in Settings
cloudflared tunnel --url http://localhost:8099
```

Then Settings → Streaming backend → that https URL → **Test connection**, which should
report `CinePro` and its version. The address lives in that device's `localStorage`, so it
is entered per device; there is no default in the code, by design.

A `trycloudflare.com` quick tunnel gets a new random hostname every run, which is fine for
testing and useless for a television. A stable hostname needs a Cloudflare account, a
domain and a named tunnel.

### Expect thin coverage

Only **2 of 14 providers return anything at all**, even from a residential IP. The rest
fail with 404s, dead fetches, or in VidNest's case a crash
(`Cannot read properties of undefined (reading 'map')`). Upstream `cinepro-org/core` has
not shipped since May 2026 and the fork is identical to its HEAD, so there is nothing to
pull. Some titles will genuinely have no source, and that is not a fault in Movway.

### Configuration traps, confirmed against real deployments

- **`NPM_CONFIG_INCLUDE=dev` / `--include=dev`.** CinePro's own `render.yaml` sets
  `NODE_ENV=production`, which makes npm set `omit=dev`. `@types/node` never installs and
  `tsc` dies with ~30 errors like `Cannot find name 'process'`.

- **`HOST=0.0.0.0`.** `src/server.ts` defaults to `localhost`, which a host cannot route
  to, so the service builds and then fails its health check.

- **`PUBLIC_URL` — no longer required, and worth knowing why.** Unset, CinePro logs
  `Proxy base URL: http://localhost:<port>` and stamps that address into every source and
  subtitle URL. Unreachable from any other machine, `http` where the TV demands https, and
  invisible from outside: the health check passes and a full set of sources comes back,
  every one of them dead. Movway now repairs this itself — `resolveUrl` re-points a
  loopback URL at the address configured in Settings, which is demonstrably the one
  reaching the backend. Setting `PUBLIC_URL` correctly is still tidier; it is no longer
  load-bearing.

- **Start with `node dist/server.js`, not `npm run start`.** That script is
  `npm run build && node dist/server.js`, so it reruns `tsc` on every boot.

### The Render service, kept as a record

`cinepro-core` · `srv-da87phifngtc73bldgl0` · Frankfurt · free plan ·
`https://cinepro-core-5kv0.onrender.com`, built from `github.com/samog76/core` @ `98ba005`
with auto-deploy off, in the `rebel.game09@gmail.com` workspace. It builds, boots and
answers `/v1/health` correctly — and returns `404` for every title, for the reason above.
It is dead weight; deleting it needs the dashboard, as the Render MCP has no delete tool.
Supabase was never viable: it hosts Postgres, Auth, Storage and Deno edge functions, not a
long-running Node server.

> **Confirm which account a connector is signed in to before creating or spending
> anything.** An earlier session had Render and Supabase authenticated as a *different
> person's* accounts (`ogheneovosegba360@gmail.com` / "thatcrazydave's Org") and created a
> stray `cinepro-core` service there, which only that account holder can delete. The
> workspace used here was checked against the owner's own email first.

---

## 5. Where everything lives

| Path | What it does |
|---|---|
| `src/lib/tv.ts` | The D-pad. Geometric focus walker with zones, key-code translation for real remote hardware, focus seeding. The most subtle file in the project. |
| `src/lib/omss.ts` | Client for the streaming backend. Fetches sources, ranks them, flags addresses the packaged app can't reach, and repairs proxy URLs a backend reports on loopback. |
| `src/components/NativePlayer.tsx` | Movway's own player: `<video>` + hls.js, controls that genuinely work, falls through to the next source on failure. |
| `src/lib/backHandler.ts` | Interceptor chain for the hardware Back button. Innermost surface claims the press first. |
| `src/components/NativeBackButton.tsx` | Wires Android's Back to the router. Walks its own route stack rather than `history.go()`. |
| `src/lib/tmdb.ts` | TMDB metadata. Uses native HTTP on device — see §7. |
| `src/lib/faults.ts` | Turns an error into a cause and a fix, printed on screen. There is no console on a television. `describeBackendFault` is the streaming-backend reading. |
| `src/pages/WatchPage.tsx` | Plays through the native player, or says plainly why it cannot; owns episode state. |
| `src/pages/SettingsPage.tsx` | Backend address, connection test, https warning. |
| `src/index.css` | Design tokens and the `html.tv` ten-foot overrides. |

---

## 6. How the remote works

- **Focus zones.** The rail and the page are separate zones. *Up and down never leave their
  zone* — you step into the menu with Left and out with Right. Without that, geometry sent
  focus into the off-canvas sidebar on every downward press.

- **Off-axis scoring.** Vertical moves score horizontal *overlap*, not centre distance.
  Centre distance punishes an element for being wide, which made the full-width player cost
  more to reach than a small dropdown far below it.

- **Refused presses are consumed.** Reaching the end of a page consumes the key rather than
  passing it to Chromium's DOM-order navigation, which ignores zones. An edge should feel
  like a wall.

- **Back, innermost first.** Player → menu → route → exit. Back never closes the app from an
  inner screen, and a boot-time handler covers the window before React mounts.

---

## 7. Traps that cost real time

- **An http backend silently fails on the TV.** The packaged app serves itself from
  `https://localhost` with mixed content disabled, so a plain `http://` address is blocked
  before a request is made — and works perfectly in a desktop browser. Settings warns now.

- **The preview server serves a stale bundle.** Several browser checks were run against an
  old build without noticing. Always `rm -rf dist`, rebuild, restart preview, and confirm
  the bundle hash in the page before trusting a result.

- **The native build uses HashRouter.** Deep paths must be `/#/watch/movie/603`. Navigating
  to `/watch/movie/603` silently renders Home, which makes tests look like they passed on
  the wrong page.

- **Gradle rejects the default JDK.** Java 25 is installed and Gradle 8.11 can't read it.
  Every APK build needs `export JAVA_HOME=$(/usr/libexec/java_home -v 21)` first.

- **Node 22 shadows jsdom's localStorage.** Node defines a global `localStorage` that needs
  a launch flag, so storage throws under test while working in a browser.
  `src/test/setup.ts` installs an in-memory one.

- **TMDB needs native HTTP on device.** Cross-origin fetches from `https://localhost` fail
  in the packaged WebView. TMDB requests go through the platform's HTTP stack on Android and
  plain `fetch` on web.

---

## 8. Building and shipping

The APK is committed to `download-site/movway.apk` and served from a Vercel deploy with that
folder as its root. Version lives in three places and they must move together:
`package.json`, `android/app/build.gradle` (`versionCode` and `versionName`), and the chip
in `download-site/index.html`.

```bash
# checks — all must pass before shipping
npx tsc --noEmit
npm run test          # 63 tests
npm run lint
npm run build

# TV build and APK (JAVA_HOME is mandatory)
export JAVA_HOME=$(/usr/libexec/java_home -v 21)
npm run tv:apk        # build:tv → cap sync android → gradlew assembleRelease

# ship
cp android/app/build/outputs/apk/release/app-release.apk download-site/movway.apk

# verify the APK actually contains the change before trusting it
unzip -q app-release.apk 'assets/public/*' -d /tmp/check
grep -rho "some-string-from-your-change" /tmp/check/assets/public/assets/*.js | wc -l
```

---

## 9. Worth doing next

- **Cast and footer are unreachable with a remote.** Cast entries are plain `<div>`s with no
  tabindex, so the D-pad can't scroll to them.
- **Subtitles are WebVTT only.** SRT and ASS from the backend are filtered out rather than
  converted, so those titles show no subtitle option.
- **Resume position isn't stored.** `continueWatching` keeps season and episode but not a
  timestamp; the native player now knows real positions, so this is newly possible.
- **Watchlist and History are dead routes.** They're in the sidebar and render a
  "coming soon" placard.
- **Quality switching reloads the stream.** It swaps the source rather than using the HLS
  variant ladder, so it restarts from position zero.
