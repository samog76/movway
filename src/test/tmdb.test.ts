import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeList(overrides: object[] = []) {
  return {
    results: overrides.map((o, i) => ({
      id: i + 1,
      title: `Movie ${i + 1}`,
      overview: "",
      poster_path: null,
      backdrop_path: null,
      vote_average: 7.5,
      media_type: "movie",
      ...o,
    })),
  };
}

// ---------------------------------------------------------------------------
// Fetch mock
// ---------------------------------------------------------------------------

function mockFetch(data: unknown, ok = true) {
  return vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    json: () => Promise.resolve(data),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("tmdb – getTrendingMovies", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch(makeList([{ id: 10, title: "Trending A" }])));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("calls the /trending/movie/week endpoint", async () => {
    const { getTrendingMovies } = await import("@/lib/tmdb");
    const result = await getTrendingMovies();
    expect(result.results).toHaveLength(1);
    expect(result.results[0].title).toBe("Trending A");

    const calledUrl: string = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(calledUrl).toContain("/trending/movie/week");
  });

  it("throws on non-ok response", async () => {
    vi.stubGlobal("fetch", mockFetch({}, false));
    const { getTrendingMovies } = await import("@/lib/tmdb");
    await expect(getTrendingMovies()).rejects.toThrow("TMDB 500");
  });
});

describe("tmdb – getTrendingTV", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch(makeList([{ id: 20, name: "Trending Show", media_type: "tv" }])));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("calls the /trending/tv/week endpoint", async () => {
    const { getTrendingTV } = await import("@/lib/tmdb");
    const result = await getTrendingTV();
    expect(result.results).toHaveLength(1);
    expect(result.results[0].name).toBe("Trending Show");

    const calledUrl: string = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(calledUrl).toContain("/trending/tv/week");
  });

  it("throws on non-ok response", async () => {
    vi.stubGlobal("fetch", mockFetch({}, false));
    const { getTrendingTV } = await import("@/lib/tmdb");
    await expect(getTrendingTV()).rejects.toThrow("TMDB 500");
  });
});

describe("tmdb – getTrending (all/week)", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch(makeList([{ id: 1 }, { id: 2 }])));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("calls the /trending/all/week endpoint", async () => {
    const { getTrending } = await import("@/lib/tmdb");
    const result = await getTrending();
    expect(result.results).toHaveLength(2);

    const calledUrl: string = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(calledUrl).toContain("/trending/all/week");
  });
});

describe("tmdb embed URL builders", () => {
  it("builds movie and TV URLs for vidcore with autoplay enabled by default", async () => {
    const { buildMovieEmbedUrl, buildTVEpisodeEmbedUrl } = await import("@/lib/tmdb");

    expect(buildMovieEmbedUrl(123)).toBe("https://vidcore.net/movie/123?autoPlay=true");
    expect(buildTVEpisodeEmbedUrl(123, 2, 5)).toBe("https://vidcore.net/tv/123/2/5?autoPlay=true");
  });

  it("applies custom query parameters for movie and TV embeds", async () => {
    const { buildMovieEmbedUrl, buildTVEpisodeEmbedUrl } = await import("@/lib/tmdb");

    expect(
      buildMovieEmbedUrl(533535, { theme: "16A085", autoPlay: false, sub: "en", hideServer: true })
    ).toBe("https://vidcore.net/movie/533535?autoPlay=false&theme=16A085&sub=en&hideServer=true");
    expect(
      buildTVEpisodeEmbedUrl(63174, 1, 5, { autoNext: true, nextButton: true, server: "Server 1" })
    ).toBe("https://vidcore.net/tv/63174/1/5?autoPlay=true&autoNext=true&nextButton=true&server=Server+1");
  });

  it("omits undefined parameters while preserving valid falsey values", async () => {
    const { buildMovieEmbedUrl } = await import("@/lib/tmdb");

    expect(
      buildMovieEmbedUrl(533535, { title: false, poster: false, startAt: 0, theme: undefined })
    ).toBe("https://vidcore.net/movie/533535?autoPlay=true&title=false&poster=false&startAt=0");
  });
});
