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
