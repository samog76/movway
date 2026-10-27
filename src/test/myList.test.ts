import { describe, it, expect, beforeEach } from "vitest";
import { getMyList, isInMyList, toggleMyList, subscribeMyList, resetMyListCache } from "@/lib/myList";
import type { Movie } from "@/lib/tmdb";

const film: Movie = { id: 603, title: "The Matrix", overview: "", poster_path: "/p.jpg", backdrop_path: null, vote_average: 8.2, release_date: "1999-03-31" };
const series: Movie = { id: 603, title: "", name: "Same id, a series", overview: "", poster_path: null, backdrop_path: null, vote_average: 7, first_air_date: "2020-01-01" };

beforeEach(() => {
  localStorage.clear();
  resetMyListCache();
});

describe("My List", () => {
  it("adds a title and removes it on a second toggle", () => {
    expect(toggleMyList(film)).toBe(true);
    expect(isInMyList(603, "movie")).toBe(true);
    expect(toggleMyList(film)).toBe(false);
    expect(getMyList()).toEqual([]);
  });

  it("tells a film from a series that shares its TMDB id", () => {
    toggleMyList(film);
    expect(isInMyList(603, "tv")).toBe(false);
    toggleMyList(series);
    expect(getMyList().map((e) => e.media_type)).toEqual(["tv", "movie"]);
  });

  it("survives a reload", () => {
    toggleMyList(film);
    resetMyListCache();
    expect(getMyList()[0].title).toBe("The Matrix");
  });

  it("tells subscribers, and returns a new array so React re-renders", () => {
    const before = getMyList();
    let calls = 0;
    const off = subscribeMyList(() => calls++);
    toggleMyList(film);
    off();
    toggleMyList(film);
    expect(calls).toBe(1);
    expect(getMyList()).not.toBe(before);
  });

  it("treats unreadable storage as an empty list", () => {
    localStorage.setItem("movway_my_list", "{not json");
    expect(getMyList()).toEqual([]);
  });
});
