# Movway

A TMDB-powered movie, TV, and anime streaming experience with discovery, search,
continue-watching, subtitles, and multiple playback providers.

Ships in two forms:

- **Web** — a Vite + React app.
- **Google TV / Android TV** — the same app wrapped in a Capacitor shell with a
  10-foot UI and D-pad navigation.

---

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

## Player controls on a remote

Playback controls belong to the provider's player inside the `<iframe>`. Movway
does not draw its own: every provider is a cross-origin embed, so nothing here
can call play/pause/seek on their video or hide their UI, and a parallel set of
controls that mostly could not act was worse than none.

What the app does instead is get the D-pad *into* that player.

- **A door, not a trap.** On TV the frame is covered by a focusable shield
  ("Press OK to use the player"). The walker in `src/lib/tv.ts` treats it as one
  ordinary focus target, so arriving at the player is deliberate. Without it,
  focus wanders into the frame in passing and the remote looks frozen.
- **OK hands the remote over.** `iframe.focus()` moves focus into the embed, and
  from then on every key press is the provider's — which is exactly what makes
  its own controls work with a D-pad.
- **Back brings it home.** Because this document stops receiving keys entirely,
  there is no keypress we could listen for to get back out. Entering pushes a
  history entry first, so the remote's Back button pops that instead of leaving
  the page, and `popstate` is the cue to take focus back and restore the shield.
- **Changing stream drops the handover**, so switching source or episode never
  strands the remote inside a frame that is being torn down.

Two D-pad rules in `tv.ts` are worth knowing about. A `<select>` claims no arrow
keys: giving it any welded the remote to the Source dropdown, because the native
element eats the key to change option and never yields focus, which also made
the player just above it unreachable. Selection happens through the WebView's
own option picker on OK, which the remote drives natively. Text inputs still
keep left/right for the caret.

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
