# Movway — handover

Everything a fresh session needs to pick this up: what the app is, what was built,
what was proven impossible and why, and the one task waiting at the front of the queue.

**State:** v1.6.1 · versionCode 16 · 77 tests passing

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
| Native player | **needs a backend** | Movway's own `<video>` + hls.js with working controls. Active only when a streaming backend is configured. |
| Embedded player | **works** | VixSrc is the only source. Movway draws its own controls over it: real position, working play/pause and seek — see §3. |
| Streaming backend | **next up** | Needs a CinePro Core instance on an **https** address. The one outstanding task. |

---

## 3. How playback is controlled

VixSrc is the only source. What it supports was **measured against the live player**, not
taken from its docs — and the docs were wrong in one place that mattered.

| Capability | Result |
|---|---|
| `startAt` seeking | **works** — a load with `startAt=120` landed at 125.9s |
| `PLAYER_EVENT` telemetry | **works** — real currentTime and duration arrive |
| Space toggles play/pause in their player | **works** |
| Arrow keys seek in their player | **no** — 0 delta across two presses while paused |
| Keys sent to the frame Movway embeds | **do not reach the player** — the handler lives in a frame nested inside it |

This last row was re-tested with a **real** key press rather than a synthetic DOM
dispatch (the browser's own input pipeline, with focus genuinely on the iframe). Playback
did not pause and the position kept advancing 13→14→15→16→17. Handing the remote to the
embed therefore cannot work, and pausing must unload the frame.

**The docs describe the telemetry payload under `data`. It actually arrives under `event`:**

```
{ type: "PLAYER_EVENT", event: { event: "timeupdate", currentTime: 40, duration: 8175.7 } }
```

Parsing the documented shape silently produced a dead scrub bar. `parseTelemetry` in
`src/lib/embedBridge.ts` accepts both.

Because keys cannot reach their player, Movway does not hand the remote over. It draws its
own controls and drives the embed through the two channels that do work:

- **Position and duration** come from their telemetry, so the clock and scrub bar show real
  numbers. A `~` prefix marks the brief window before the player reports in.
- **Seeking** reloads the frame at a new `startAt`.
- **Play/pause** tears the frame down — the only thing that reliably stops a player that
  ignores commands — and puts it back at the captured offset.

Verified end to end against the live embed: pause removed the frame, resume returned it at
`startAt=8`, forward-a-minute moved `startAt` 8 → 91, and the scrub bar carried the real
duration of 8176s.

Resuming reloads the provider's page — unavoidable, since unloading is the only thing that
stops it. What is avoidable is *looking* like a restart, so the known duration and position
survive a same-title reload (the scrub bar keeps its range rather than collapsing to empty)
and a "Resuming at 00:20" notice covers the wait. That notice ends when the player reports
in, capped at six seconds so a silent provider never leaves it sitting over playing film.

Their own chrome stays visible underneath, because a cross-origin frame's UI cannot be
removed. Nothing on screen depends on it.

### The other path: a streaming backend

`src/lib/omss.ts` and `src/components/NativePlayer.tsx` still exist and are dormant. If a
CinePro Core address is set in Settings, Movway plays the stream in its own `<video>` with
hls.js instead of embedding anything, which is strictly better — every control is a plain
operation on an element the app owns. See §4.

## 4. The one task outstanding

Stand up a **CinePro Core** instance ([docs.cinepro.cc](https://docs.cinepro.cc)) and put
its address into Movway's Settings. Everything on the app side is finished and waiting.

> ### Read before deploying
>
> In a previous session the Render and Supabase connectors were authenticated as a
> **different person's accounts** (`ogheneovosegba360@gmail.com` / "thatcrazydave's Org"),
> not the repo owner's. A `cinepro-core` service was created there by mistake and needs
> deleting by that account holder — the Render MCP has no delete tool, and the owner sees
> "Access denied".
>
> **Confirm which account a connector is signed in to before creating, deploying, or
> spending anything.**

### Steps

1. **Confirm the Render account is yours.** List workspaces and check the email against
   your own before doing anything else. If it isn't yours, stop and reconnect Render in
   your Claude connector settings.

2. **Deploy CinePro Core.** Render only deploys repos connected to your GitHub, so use the
   existing fork at `github.com/samog76/core`. It is a Node service, not Docker.

   ```
   # Build and start commands
   npm install && npm run build
   npm run start

   # Environment
   NODE_ENV=production
   HOST=0.0.0.0
   CORS_ORIGIN=*
   CACHE_TYPE=memory
   PUBLIC_URL=https://<your-service>.onrender.com
   NPM_CONFIG_INCLUDE=dev   # see step 3
   TMDB_API_KEY=<your key — add it yourself in the dashboard>
   ```

3. **Work around CinePro's blueprint bug.** Their published `render.yaml` sets
   `NODE_ENV=production`, which makes `npm install` skip devDependencies. `@types/node`
   never installs and the TypeScript build dies with ~30 errors like
   `Cannot find name 'process'`. Setting `NPM_CONFIG_INCLUDE=dev` fixes it.

4. **Point Movway at it.** Settings → Streaming backend → the https URL → **Test
   connection**. It should report the backend's name and version. The watch page then uses
   the native player automatically.

### Worth weighing first

Render's free plan sleeps after ~15 minutes idle, so the first title after a break waits
~50s on a cold start — genuinely irritating on a TV. Starter (~$7/mo) stays warm. A
**Cloudflare Tunnel to a machine at home** is also a strong option: free, a real https
hostname, and no cold starts. Supabase is **not** viable — it hosts Postgres, Auth, Storage
and Deno edge functions, not a long-running Node server.

---

## 5. Where everything lives

| Path | What it does |
|---|---|
| `src/lib/tv.ts` | The D-pad. Geometric focus walker with zones, key-code translation for real remote hardware, focus seeding. The most subtle file in the project. |
| `src/lib/omss.ts` | Client for the streaming backend. Fetches sources, resolves proxy paths, ranks sources, flags addresses the packaged app can't reach. |
| `src/components/NativePlayer.tsx` | Movway's own player: `<video>` + hls.js, controls that genuinely work, falls through to the next source on failure. |
| `src/lib/providers.ts` | The two embed providers, VidLink and VidCore, and their URL builders. |
| `src/lib/sourceFallback.ts` | When to abandon the default embed for the alternate. Policy only, so it can be read and tested alone. |
| `src/lib/backHandler.ts` | Interceptor chain for the hardware Back button. Innermost surface claims the press first. |
| `src/components/NativeBackButton.tsx` | Wires Android's Back to the router. Walks its own route stack rather than `history.go()`. |
| `src/lib/tmdb.ts` | TMDB metadata. Uses native HTTP on device — see §7. |
| `src/lib/faults.ts` | Turns an error into a cause and a fix, printed on screen. There is no console on a television. |
| `src/pages/WatchPage.tsx` | Chooses between native player and embed; owns episode, source and subtitle state. |
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

- **`npx tsc --noEmit` checks nothing.** `tsconfig.json` has `"files": []` and only project
  references, so that command silently passes with real type errors present. It hid three.
  Use `npm run typecheck` (`tsc -b --noEmit`), which is now a script.

- **A provider's docs are not its behaviour.** VixSrc's telemetry shape differs from what it
  publishes. Measure against the live player before building on a documented contract.

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
npm run test          # 77 tests
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

## 9. Worth doing after the backend is up

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
