import { describe, it, expect, beforeEach } from "vitest";
import {
  VIDEO_PROVIDERS,
  DEFAULT_PROVIDER_ID,
  FALLBACK_PROVIDER_ID,
  getProvider,
  loadProviderId,
  saveProviderId,
} from "@/lib/providers";

beforeEach(() => window.localStorage.clear());

describe("providers registry", () => {
  it("offers exactly the two sources worth keeping", () => {
    expect(VIDEO_PROVIDERS.map((p) => p.id)).toEqual(["vidlink", "vidcore"]);
  });

  it("defaults to VidLink and falls back to VidCore", () => {
    expect(DEFAULT_PROVIDER_ID).toBe("vidlink");
    expect(FALLBACK_PROVIDER_ID).toBe("vidcore");
    expect(getProvider(FALLBACK_PROVIDER_ID).name).toBe("VidCore");
  });

  it("falls back to the default for an unknown id", () => {
    expect(getProvider("does-not-exist").id).toBe(DEFAULT_PROVIDER_ID);
  });
});

describe("remembering a source", () => {
  it("returns the default when nothing is stored", () => {
    expect(loadProviderId()).toBe(DEFAULT_PROVIDER_ID);
  });

  it("returns a stored source that still exists", () => {
    saveProviderId("vidcore");
    expect(loadProviderId()).toBe("vidcore");
  });

  it("ignores a source that has since been removed", () => {
    // Anyone who picked one of the sources dropped in v1.4.2 still has its id
    // in storage; honouring it would leave them on a source that is gone.
    window.localStorage.setItem("movway:provider", "vsembed");
    expect(loadProviderId()).toBe(DEFAULT_PROVIDER_ID);
  });
});

describe("vidlink urls", () => {
  const vidlink = getProvider("vidlink");

  it("builds a movie url with autoplay and the app accent", () => {
    const url = new URL(vidlink.buildMovieUrl(603));
    expect(url.origin + url.pathname).toBe("https://vidlink.pro/movie/603");
    expect(url.searchParams.get("autoplay")).toBe("true");
    expect(url.searchParams.get("primaryColor")).toBe("CCFF00");
    expect(url.searchParams.get("startTime")).toBeNull();
  });

  it("seeks by start offset", () => {
    const url = new URL(vidlink.buildMovieUrl(603, { startAt: 125.6 }));
    expect(url.searchParams.get("startTime")).toBe("126");
  });

  it("builds a tv episode url", () => {
    const url = new URL(vidlink.buildTVUrl(1399, 2, 5));
    expect(url.origin + url.pathname).toBe("https://vidlink.pro/tv/1399/2/5");
  });
});

describe("vidcore urls", () => {
  const vidcore = getProvider("vidcore");

  it("carries the subtitle language it supports", () => {
    expect(vidcore.supportsSubtitles).toBe(true);
    const url = new URL(vidcore.buildMovieUrl(603, { sub: "es" }));
    expect(url.searchParams.get("sub")).toBe("es");
  });

  it("builds a tv episode url with autonext", () => {
    const url = new URL(vidcore.buildTVUrl(1399, 2, 5));
    expect(url.pathname).toContain("/tv/1399/2/5");
    expect(url.searchParams.get("autoNext")).toBe("true");
  });
});
