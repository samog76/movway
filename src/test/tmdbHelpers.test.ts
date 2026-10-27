import { describe, it, expect } from "vitest";
import { genreName, mediaTypeOf, pickLogo, type Movie, type TmdbImage } from "@/lib/tmdb";

const base: Movie = { id: 1, title: "", overview: "", poster_path: null, backdrop_path: null, vote_average: 0 };

describe("mediaTypeOf", () => {
  it("trusts an explicit media type", () => {
    expect(mediaTypeOf({ ...base, title: "Film", media_type: "tv" })).toBe("tv");
  });

  it("reads a series from its air date or name when the list leaves the type out", () => {
    expect(mediaTypeOf({ ...base, first_air_date: "2020-01-01" })).toBe("tv");
    expect(mediaTypeOf({ ...base, name: "A Series" })).toBe("tv");
    expect(mediaTypeOf({ ...base, title: "A Film", release_date: "2020-01-01" })).toBe("movie");
  });
});

describe("pickLogo", () => {
  const logo = (file_path: string, iso_639_1: string | null, vote_average = 5): TmdbImage => ({ file_path, iso_639_1, vote_average });

  it("prefers the best-rated English logo", () => {
    expect(pickLogo([logo("/fr.png", "fr", 9), logo("/en-low.png", "en", 3), logo("/en.png", "en", 8)])).toBe("/en.png");
  });

  it("falls back to a language-neutral logo, never a foreign-language one", () => {
    expect(pickLogo([logo("/fr.png", "fr", 9), logo("/neutral.png", null)])).toBe("/neutral.png");
    expect(pickLogo([logo("/fr.png", "fr", 9)])).toBeNull();
  });

  it("has nothing to pick from an absent or empty list", () => {
    expect(pickLogo(undefined)).toBeNull();
    expect(pickLogo([])).toBeNull();
  });
});

describe("genreName", () => {
  it("names movie and series genres, and leaves unknown ids unnamed", () => {
    expect(genreName(18)).toBe("Drama");
    expect(genreName(10765)).toBe("Sci-Fi & Fantasy");
    expect(genreName(-1)).toBeUndefined();
  });
});
