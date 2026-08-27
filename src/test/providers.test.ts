import { describe, it, expect, beforeEach } from "vitest";
import {
  VIDEO_PROVIDERS,
  DEFAULT_PROVIDER_ID,
  getProvider,
  loadProviderId,
  saveProviderId,
} from "@/lib/providers";

beforeEach(() => window.localStorage.clear());

describe("providers registry", () => {
  it("offers VixSrc and nothing else", () => {
    expect(VIDEO_PROVIDERS.map((p) => p.id)).toEqual(["vixsrc"]);
    expect(DEFAULT_PROVIDER_ID).toBe("vixsrc");
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
    window.localStorage.setItem("movway:provider", "vidlink");
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
