import { describe, it, expect } from "vitest";
import { VIDEO_PROVIDERS, getProvider } from "@/lib/providers";

const vsembed = getProvider("vsembed");

describe("providers registry", () => {
  it("includes the vsembed provider", () => {
    expect(VIDEO_PROVIDERS.some((p) => p.id === "vsembed")).toBe(true);
  });

  it("falls back to the default provider for unknown ids", () => {
    expect(getProvider("does-not-exist").id).toBe(VIDEO_PROVIDERS[0].id);
  });
});

describe("vsembed urls", () => {
  it("builds a movie url with tmdb id and autoplay", () => {
    const url = new URL(vsembed.buildMovieUrl(385687));
    expect(url.origin + url.pathname).toBe("https://vsembed.ru/embed/movie");
    expect(url.searchParams.get("tmdb")).toBe("385687");
    expect(url.searchParams.get("autoplay")).toBe("1");
    expect(url.searchParams.get("ds_lang")).toBeNull();
  });

  it("passes the subtitle language as ds_lang when set", () => {
    const url = new URL(vsembed.buildMovieUrl(385687, { sub: "es" }));
    expect(url.searchParams.get("ds_lang")).toBe("es");
  });

  it("builds a tv episode url with season, episode and autonext", () => {
    const url = new URL(vsembed.buildTVUrl(1399, 2, 5, { sub: "en" }));
    expect(url.origin + url.pathname).toBe("https://vsembed.ru/embed/tv");
    expect(url.searchParams.get("tmdb")).toBe("1399");
    expect(url.searchParams.get("season")).toBe("2");
    expect(url.searchParams.get("episode")).toBe("5");
    expect(url.searchParams.get("autonext")).toBe("1");
    expect(url.searchParams.get("ds_lang")).toBe("en");
  });
});
