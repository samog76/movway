# Movway

A TMDB-powered movie, TV, and anime streaming experience with discovery, search,
continue-watching, subtitles, and multiple playback providers.

Ships in two forms:

- **Web** — a Vite + React app.
- **Google TV / Android TV** — the same app wrapped in a Capacitor shell with a
  10-foot UI and D-pad navigation.

---

> **Picking this up fresh?** Read [HANDOVER.md](HANDOVER.md) first. It covers what the app
> is, what was measured to be impossible inside the embedded players (and why), the one task
> outstanding, and the traps that cost real time.

## Web app

```bash
npm install
npm run dev          # http://localhost:8080
npm run build        # production bundle → dist/
npm run test
npm run lint
```

A TMDB key is optional for development (a fallback is built in). To use your own,
copy `.env.example` to `.env` and set `VITE_TMDB_API_KEY`.

---

## Playback

Movway can play a title two ways, and which one it uses decides whether its own
controls do anything.

### Its own player (a streaming backend)

Point Movway at an [OMSS](https://docs.cinepro.cc) backend — a self-hosted
CinePro Core instance, for example — under **Settings → Streaming backend**. It
then asks that backend for the stream and plays it in its own `<video>` with
hls.js, so play, pause, seek, subtitles and volume are ordinary operations on an
element the app owns. This is the only arrangement where a remote can drive
playback.

The backend needs a TMDB key and must be reachable from the TV **over https**:
the Android build serves itself from `https://localhost` with mixed content
disabled, so a plain `http://` address is blocked by the WebView before a
request is made. It works in a desktop browser, which is how that trap stays
hidden during development — Settings warns when an address will not work on the
TV.

CinePro Core ships a Render blueprint (`render.yaml`), which is the easiest way
to get an https URL; a home server works too behind a TLS reverse proxy. Note
that Render's free plan sleeps after inactivity, so the first play after a
break waits on a cold start. Set `PUBLIC_URL` to the deployed URL. CinePro Core
is licensed for personal use.

Every URL it returns is a path onto its own proxy, so upstream headers and CORS
are its problem rather than the app's.

`src/lib/omss.ts` is the client; `src/components/NativePlayer.tsx` is the player.
Sources are ranked so a playable type and the highest resolution come first, and
a source that fails hands over to the next one before giving up.

### Embedded players (the fallback)

With no backend configured — or if nothing it offers will play — Movway falls
back to embedding VidLink (default) or VidCore in an `<iframe>`, which is how it
worked before. Those are worth understanding, because their limits are what
motivated the player above:

- **Commands are ignored.** Sending the five common postMessage dialects to
  VidLink was measured to change nothing; playback carried on.
- **Their player has no keyboard handling.** Dispatching Space and ArrowRight at
  its document, body and video element moved neither playback nor position, so a
  D-pad cannot drive it even with focus delivered perfectly.
- **Their UI cannot be removed or mirrored.** A cross-origin frame cannot be
  drawn to a canvas or captured, and CSS cropping cannot remove controls that sit
  over the video.

So the embed path gives a picture and nothing else: the on-screen chrome there
can switch source, change episode and go fullscreen, but not pause. If VidLink
stays silent past `FALLBACK_AFTER_MS` it switches to VidCore on its own — see
`src/lib/sourceFallback.ts`.

## Google TV build

### How TV mode works

`src/lib/tv.ts` detects a TV in two ways: the Capacitor shell appends `MovwayTV`
to the user agent (see `capacitor.config.ts`), and there is a user-agent fallback
for TV browsers. When detected it adds `.tv` to `<html>`, which turns on the
10-foot styles at the bottom of `src/index.css` — larger root font, overscan-safe
margins, and a heavier focus ring.

Because the focus ring *is* the cursor on a TV, every hover state in the app has a
matching `focus-visible` state.

**D-pad navigation is ours, not the browser's.** Chromium moves focus in DOM
order, which on a poster wall means landing on a row's scroll buttons and never
reaching the posters — and anything scrolled outside a horizontal rail is
unreachable entirely. `lib/tv.ts` instead picks the nearest focusable element in
the direction pressed, keeps left/right inside the current row, and scrolls the
rail as focus travels. Holding a direction switches from smooth to instant
scrolling so fast movement never lags behind the remote.

**TV mode is also a performance mode.** A TV SoC is far weaker than a phone, and
this design's full-screen blended grain layer and three animated 140px blurs cost
more than the entire scroll budget on that hardware. Both are disabled under
`html.tv`, along with scroll snapping (which fights programmatic scrolling) and
the pointer-only row arrows.

Sizing is driven off the viewport (`clamp()` on the root font and the rail width)
so the same build fits a 960×540 WebView and a 4K panel without a media query.

To work on any of this without a TV in front of you, append `?tv=1` to the dev
server URL — it forces TV mode on in a desktop browser.

The native bundle is built with `VITE_NATIVE=1`, which switches the router to
`HashRouter` — a WebView reload on a deep path has no server to fall back to
`index.html`.

### Building the APK

Requires a JDK (17 or 21) and the Android SDK.

```bash
npm run tv:apk
```

That runs `build:tv` → `cap sync android` → `gradlew assembleRelease`. The output
lands in `android/app/build/outputs/apk/release/`.

Signing: `android/keystore.properties` (git-ignored) supplies the release keystore.
Create one with:

```bash
keytool -genkeypair -v -keystore movway-release.keystore \
  -alias movway -keyalg RSA -keysize 2048 -validity 10000
```

then write `android/keystore.properties`:

```properties
storeFile=../movway-release.keystore
storePassword=…
keyAlias=movway
keyPassword=…
```

Without that file the release build falls back to debug signing, which still
installs on a TV via sideload.

### TV-specific Android wiring

`android/app/src/main/AndroidManifest.xml` carries the Google TV requirements:

- `LEANBACK_LAUNCHER` intent filter, so the app appears on the TV home row
- `android.hardware.touchscreen` marked **not required** (a TV has none — the
  install fails without this)
- `android.software.leanback` declared but not required, so the same APK still
  sideloads onto a phone
- `android:banner` — the 320×180 home-row artwork
- landscape orientation

### Regenerating the banner and icons

Art is generated from inline SVG and committed, so a normal build never needs this:

```bash
npm i --no-save sharp
node scripts/gen-tv-assets.mjs
```

---

## Download site

`download-site/` is a self-contained static page for distributing the APK,
deployable to Vercel with **Root Directory** set to `download-site`. Drop the
built APK in as `download-site/movway.apk`; `vercel.json` sets the headers that
make it download rather than render.
