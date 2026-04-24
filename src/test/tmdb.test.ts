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
  it("builds movie and TV URLs for vidplus", async () => {
    const { buildMovieEmbedUrl, buildTVEpisodeEmbedUrl } = await import("@/lib/tmdb");

    expect(buildMovieEmbedUrl("vidplus", 123)).toBe("https://player.vidplus.to/embed/movie/123");
    expect(buildTVEpisodeEmbedUrl("vidplus", 123, 2, 5)).toBe("https://player.vidplus.to/embed/tv/123/2/5");
  });

  it("builds movie and TV URLs for vidsrc-embed", async () => {
    const { buildMovieEmbedUrl, buildTVEpisodeEmbedUrl } = await import("@/lib/tmdb");

    expect(buildMovieEmbedUrl("vidsrc-embed", 123)).toBe("https://vidsrc-embed.ru/embed/movie/123");
    expect(buildTVEpisodeEmbedUrl("vidsrc-embed", 123, 2, 5)).toBe("https://vidsrc-embed.ru/embed/tv/123/2/5");
  });

  it("resolves invalid providers to vidplus", async () => {
    const { resolveEmbedApiProvider } = await import("@/lib/tmdb");

    expect(resolveEmbedApiProvider("unknown-provider")).toBe("vidplus");
    expect(resolveEmbedApiProvider(null)).toBe("vidplus");
  });
});

describe("vidsrc embed list endpoints", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("calls latest movies endpoint with page number", async () => {
    vi.stubGlobal("fetch", mockFetch({ results: [] }));
    const { getVidsrcEmbedLatestMovies } = await import("@/lib/tmdb");

    await getVidsrcEmbedLatestMovies(2);

    const calledUrl: string = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(calledUrl).toBe("https://vidsrc-embed.ru/movies/latest/page-2.json");
  });

  it("calls latest episodes endpoint with page number", async () => {
    vi.stubGlobal("fetch", mockFetch({ results: [] }));
    const { getVidsrcEmbedLatestEpisodes } = await import("@/lib/tmdb");

    await getVidsrcEmbedLatestEpisodes(3);

    const calledUrl: string = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(calledUrl).toBe("https://vidsrc-embed.ru/episodes/latest/page-3.json");
  });

  it("throws when page number is missing or invalid", async () => {
    vi.stubGlobal("fetch", mockFetch({ results: [] }));
    const { getVidsrcEmbedLatestMovies, getVidsrcEmbedLatestEpisodes } = await import("@/lib/tmdb");

    expect(() => getVidsrcEmbedLatestMovies(0)).toThrow(
      "Page number must be an integer greater than or equal to 1."
    );
    expect(() => getVidsrcEmbedLatestMovies(1.5)).toThrow(
      "Page number must be an integer greater than or equal to 1."
    );
    expect(() => getVidsrcEmbedLatestEpisodes(-1)).toThrow(
      "Page number must be an integer greater than or equal to 1."
    );
    expect(() => getVidsrcEmbedLatestEpisodes(Number.NaN)).toThrow(
      "Page number must be an integer greater than or equal to 1."
    );
  });
});
