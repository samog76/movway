import { describe, it, expect, beforeEach } from "vitest";
import {
  VIDEO_PROVIDERS,
  nextProviderId,
  DEFAULT_PROVIDER_ID,
  getProvider,
  loadProviderId,
  saveProviderId,
} from "@/lib/providers";

beforeEach(() => window.localStorage.clear());

describe("providers registry", () => {
  it("leads with VixSrc and keeps somewhere to fall back to", () => {
    expect(VIDEO_PROVIDERS.map((p) => p.id)).toEqual(["vixsrc", "vidlink", "vidcore", "vidapi"]);
    expect(DEFAULT_PROVIDER_ID).toBe("vixsrc");
  });

  it("every source can be seeked, since that is how the controls work", () => {
    for (const p of VIDEO_PROVIDERS) {
      expect(p.supportsStartAt, `${p.id} cannot seek`).toBe(true);
      expect(p.origin).toMatch(/^https:\/\//);
    }
  });

  it("declares the capabilities the controls are built on", () => {
    const vixsrc = getProvider("vixsrc");
    // Seeking is performed by reloading at an offset, so this flag is what
    // makes the seek controls real rather than decorative.
    expect(vixsrc.supportsStartAt).toBe(true);
    expect(vixsrc.origin).toBe("https://vixsrc.to");
  });

  it("falls back to the default for an unknown id", () => {
    expect(getProvider("does-not-exist").id).toBe(DEFAULT_PROVIDER_ID);
  });

  it("ignores a stored source that has since been removed", () => {
    window.localStorage.setItem("movway:provider", "vsembed");
    expect(loadProviderId()).toBe(DEFAULT_PROVIDER_ID);
  });

  it("remembers a source that still exists", () => {
    saveProviderId("vixsrc");
    expect(loadProviderId()).toBe("vixsrc");
  });
});

describe("vixsrc urls", () => {
  const vixsrc = getProvider("vixsrc");

  it("builds a movie url themed to the app accent", () => {
    const url = new URL(vixsrc.buildMovieUrl(603));
    expect(url.origin + url.pathname).toBe("https://vixsrc.to/movie/603");
    expect(url.searchParams.get("autoplay")).toBe("true");
    expect(url.searchParams.get("primaryColor")).toBe("CCFF00");
    expect(url.searchParams.get("startAt")).toBeNull();
  });

  it("seeks by start offset, rounded to whole seconds", () => {
    const url = new URL(vixsrc.buildMovieUrl(603, { startAt: 125.6 }));
    expect(url.searchParams.get("startAt")).toBe("126");
  });

  it("omits the offset at the start of a title", () => {
    const url = new URL(vixsrc.buildMovieUrl(603, { startAt: 0 }));
    expect(url.searchParams.get("startAt")).toBeNull();
  });

  it("builds a tv episode url and carries the language", () => {
    const url = new URL(vixsrc.buildTVUrl(1399, 2, 5, { sub: "en" }));
    expect(url.origin + url.pathname).toBe("https://vixsrc.to/tv/1399/2/5");
    expect(url.searchParams.get("lang")).toBe("en");
  });
});

describe("moving on from a source that will not play", () => {
  it("walks the list in order", () => {
    expect(nextProviderId("vixsrc")).toBe("vidlink");
    expect(nextProviderId("vidlink")).toBe("vidcore");
  });

  it("reports when there is nowhere left to go", () => {
    // The UI shows its own explanation only at this point, rather than
    // switching silently forever.
    expect(nextProviderId("vidcore")).toBeNull();
  });

  it("does not loop back round", () => {
    const seen = new Set<string>();
    let id: string | null = "vixsrc";
    while (id) {
      expect(seen.has(id), `revisited ${id}`).toBe(false);
      seen.add(id);
      id = nextProviderId(id);
    }
    // Every source the app is willing to choose for itself, and only those.
    expect([...seen]).toEqual(VIDEO_PROVIDERS.filter((p) => p.autoFallback).map((p) => p.id));
  });
});

describe("vidapi urls", () => {
  const vidapi = getProvider("vidapi");

  /**
   * The reason this source is here at all: it is the only one that can be told
   * to draw no controls, leaving Movway's as the only ones on screen. If these
   * two parameters ever stop being sent, the viewer gets two sets of controls
   * again and the remote starts fighting the player's own chrome.
   */
  it("asks the player to draw none of its own chrome", () => {
    const url = new URL(vidapi.buildMovieUrl(603));
    expect(url.searchParams.get("controls")).toBe("false");
    expect(url.searchParams.get("overlay")).toBe("false");
    expect(vidapi.hidesOwnControls).toBe(true);
  });

  it("takes a bare TMDB id, which is what Movway already carries", () => {
    const url = new URL(vidapi.buildMovieUrl(1147301));
    expect(url.origin + url.pathname).toBe("https://vaplayer.ru/embed/movie/1147301");
    expect(url.searchParams.get("autoplay")).toBe("1");
  });

  it("builds an episode url from season and episode", () => {
    const url = new URL(vidapi.buildTVUrl(205715, 1, 3));
    expect(url.origin + url.pathname).toBe("https://vaplayer.ru/embed/tv/205715/1/3");
  });

  // VidAPI spells the start offset `resumeAt`; sending `startAt` would be
  // accepted as an alias, but seeking is the one thing that must not go quiet.
  it("seeks with resumeAt, rounded to whole seconds", () => {
    const url = new URL(vidapi.buildMovieUrl(603, { startAt: 300.6 }));
    expect(url.searchParams.get("resumeAt")).toBe("301");
  });

  it("omits the offset at the start of a title", () => {
    expect(new URL(vidapi.buildMovieUrl(603)).searchParams.get("resumeAt")).toBeNull();
    expect(new URL(vidapi.buildMovieUrl(603, { startAt: 0 })).searchParams.get("resumeAt")).toBeNull();
  });

  it("passes a language through and themes the player", () => {
    const url = new URL(vidapi.buildMovieUrl(603, { sub: "fr" }));
    expect(url.searchParams.get("lang")).toBe("fr");
    expect(url.searchParams.get("primaryColor")).toBe("#CCFF00");
  });
});

describe("only one source hides its own controls", () => {
  it("keeps the others honest about drawing their own chrome", () => {
    const hiding = VIDEO_PROVIDERS.filter((p) => p.hidesOwnControls).map((p) => p.id);
    expect(hiding).toEqual(["vidapi"]);
  });
});

describe("a source the app will offer but not choose", () => {
  /**
   * VidAPI was never seen to play from the network it was tested on: its shell
   * loads and no video ever appears. Automatic failover therefore skips it —
   * being handed a source that stays black is worse than being told there is
   * nowhere left to go.
   */
  it("is left out of the automatic chain", () => {
    expect(getProvider("vidapi").autoFallback).toBe(false);
    expect(nextProviderId("vidcore")).toBeNull();
    expect(nextProviderId("vixsrc")).toBe("vidlink");
    expect(nextProviderId("vidlink")).toBe("vidcore");
  });

  it("can still be chosen by hand and remembered", () => {
    saveProviderId("vidapi");
    expect(loadProviderId()).toBe("vidapi");
    expect(getProvider("vidapi").name).toBe("VidAPI");
  });
});
