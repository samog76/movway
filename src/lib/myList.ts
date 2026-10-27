import { Movie, mediaTypeOf } from "./tmdb";

/**
 * Titles saved for later. Local to the device, like Continue Watching: a TV
 * is one household's screen, and there is no account to sync it to.
 */
export interface ListEntry extends Movie {
  media_type: "movie" | "tv";
  addedAt: number;
}

const STORAGE_KEY = "movway_my_list";
const listeners = new Set<() => void>();
let cache: ListEntry[] | null = null;

function read(): ListEntry[] {
  if (cache) return cache;
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    cache = Array.isArray(parsed) ? (parsed as ListEntry[]) : [];
  } catch {
    cache = [];
  }
  return cache;
}

function write(entries: ListEntry[]) {
  cache = entries;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Storage full or blocked: the list still works for this session.
  }
  listeners.forEach((l) => l());
}

const sameTitle = (a: { id: number; media_type: string }, id: number, type: string) =>
  a.id === id && a.media_type === type;

/** Newest first, the order a viewer expects to find what they just saved. */
export function getMyList(): ListEntry[] {
  return read();
}

export function isInMyList(id: number, type: "movie" | "tv"): boolean {
  return read().some((e) => sameTitle(e, id, type));
}

/** Adds the title, or removes it if already saved. Returns whether it is saved now. */
export function toggleMyList(item: Movie): boolean {
  const type = mediaTypeOf(item);
  const entries = read();
  if (entries.some((e) => sameTitle(e, item.id, type))) {
    write(entries.filter((e) => !sameTitle(e, item.id, type)));
    return false;
  }
  const entry: ListEntry = {
    id: item.id,
    title: item.title,
    name: item.name,
    overview: item.overview,
    poster_path: item.poster_path,
    backdrop_path: item.backdrop_path,
    vote_average: item.vote_average,
    release_date: item.release_date,
    first_air_date: item.first_air_date,
    genre_ids: item.genre_ids,
    media_type: type,
    addedAt: Date.now(),
  };
  write([entry, ...entries]);
  return true;
}

export function subscribeMyList(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** For tests: forget the in-memory copy so storage is read again. */
export function resetMyListCache(): void {
  cache = null;
}
