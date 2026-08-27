# Start here — Movway, on the machine at home

You are running on Samuel's Mac, with his files and his network. The session that wrote
this note was a cloud container: no access to `/Users/samuel`, and an egress proxy that
blocked every external host. That is the only reason this work is being handed over — the
remaining steps need a real machine on a real connection, and you have both.

Read `HANDOVER.md` first for what Movway is and how it is built. This note is only the
part that needs doing now.

**Branch:** `claude/new-session-hfeetm` — check it out before anything else. It is 3
commits ahead of `main` and open as
[PR #18](https://github.com/samog76/movway/pull/18), green and mergeable.

```bash
git fetch origin && git checkout claude/new-session-hfeetm && git pull
npm install
```

---

## The one thing to get working

**Play a title end to end through Movway's own player.** Nothing else is blocked.

This has never been done. Everything up to it is verified; the last step needs a machine
whose IP the providers will talk to, which is yours and was not the cloud's.

### 1 · Run CinePro at home

```bash
git clone https://github.com/samog76/core ~/core   # if not already there
cd ~/core
npm install --include=dev && npm run build
HOST=0.0.0.0 PORT=8099 CACHE_TYPE=memory \
  TMDB_API_KEY=2dca580c2a14b55200e784d157207b4d \
  node dist/server.js
```

`--include=dev` is load-bearing: `tsc` is a devDependency and `NODE_ENV=production` makes
npm skip it. That key is the one already committed as the fallback in `src/lib/tmdb.ts`.

Confirm it works before going further:

```bash
curl -s http://127.0.0.1:8099/v1/movies/603 | head -c 400
```

Expect sources from **VixSrc** and **FshareTV**. If you get
`No streaming sources found`, stop and read §4 of `HANDOVER.md` — do not assume it is
misconfigured, because it probably is not.

### 2 · Expose it over https

```bash
cloudflared tunnel --url http://localhost:8099
```

https is not optional. The packaged app serves itself from `https://localhost` with mixed
content disabled, so a plain `http://` address is blocked before a request is made — and
works perfectly in a desktop browser, which is exactly how it hides.

You do **not** need to set `PUBLIC_URL`. Movway repairs loopback proxy URLs itself now
(`resolveUrl` in `src/lib/omss.ts`). Setting it is tidier, not required.

### 3 · Point Movway at it and press play

Run `npm run dev` in the movway checkout, open Settings, paste the tunnel URL, press
**Test connection** — it should report `CinePro · 1.0.0` — then open a title.

The slate bar above the player names the source. If it says a provider name or `Direct`,
the backend is feeding the native player. There is no embed to fall back to any more, so
if something is wrong the page says what, in words, rather than showing a picture.

Then confirm the controls actually work: play, pause, seek, and the episode buttons on a
series.

---

## Already done — do not redo

- **The embeds are gone.** VidLink and VidCore, the iframe, the fallback timer, and the
  focus-shield machinery for handing the remote into a cross-origin frame. `HANDOVER.md`
  §3 records the four measurements proving they could never be controlled by a remote.
  They also hid a broken backend behind a working picture, which is why testing was
  impossible until they went.
- **Loopback URL repair.** A backend with no `PUBLIC_URL` hands back
  `http://localhost:<port>/v1/proxy?…` for every source. `resolveUrl` re-points those at
  the address configured in Settings. Verified against a stub: sources served on
  `localhost:9999` were requested on the configured `127.0.0.1:8099`.
- **The cloud-host question is settled.** Do not try another cloud provider expecting a
  different result; the block is on datacenter IP ranges generally, not on Render.

## Known and unfixed

- **Only 2 of 14 CinePro providers work**, even from home. Upstream has not shipped since
  May 2026 and the fork is identical to its HEAD. Some titles will have no source at all.
  That is not a Movway bug and not worth debugging as one.
- **The APK is stale.** `download-site/movway.apk` is the old build and still contains the
  embeds, so sideloading it will not show any of this. Rebuilding needs
  `export JAVA_HOME=$(/usr/libexec/java_home -v 21)` first — Gradle 8.11 cannot read the
  Java 25 that is installed. Then `npm run tv:apk`, and verify the APK really contains the
  change before trusting it (recipe in `HANDOVER.md` §8). Version moves in three places
  together: `package.json`, `android/app/build.gradle`, and the chip in
  `download-site/index.html`.
- **A quick tunnel's hostname changes every run**, so it is no good for a television. A
  stable one needs a Cloudflare account, a domain and a named tunnel.

## Checks before any push

```bash
npx tsc --noEmit
npm run test          # 63 passing
npm run lint          # 3 errors are PRE-EXISTING — shadcn ui/ and tailwind.config.ts
npm run build
```

`npm run lint` has never been clean on this repo. Confirm any error you see is one of
those three before treating it as yours.

## Traps worth knowing before you hit them

- **The native build uses HashRouter.** Deep paths must be `/#/watch/movie/603`.
  `/watch/movie/603` silently renders Home, which makes a test look like it passed on the
  wrong page.
- **The preview server serves a stale bundle.** `rm -rf dist`, rebuild, restart, and check
  the bundle hash before trusting a negative result.
- **There is no console on a television.** `src/lib/faults.ts` turns an error into a cause
  and a fix printed on screen; `describeBackendFault` is the streaming-backend reading.
  Keep that habit — a silent failure on a TV is undiagnosable.
