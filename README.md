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

## Google TV build

### How TV mode works

`src/lib/tv.ts` detects a TV in two ways: the Capacitor shell appends `MovwayTV`
to the user agent (see `capacitor.config.ts`), and there is a user-agent fallback
for TV browsers. When detected it adds `.tv` to `<html>`, which turns on the
10-foot styles at the bottom of `src/index.css` — larger root font, overscan-safe
margins, and a heavier focus ring.

Because the focus ring *is* the cursor on a TV, every hover state in the app has a
matching `focus-visible` state, and focus is scrolled into a comfortable position
rather than left against a screen edge.

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
