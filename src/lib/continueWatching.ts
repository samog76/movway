import { Movie } from "./tmdb";

export interface WatchEntry extends Movie {
  media_type: "tv" | "movie";
  season?: number;
  episode?: number;
  updatedAt: number;
}

const STORAGE_KEY = "movway_continue_watching";

export function getContinueWatching(): WatchEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as WatchEntry[];
  } catch {
    return [];
  }
}

export function upsertWatchEntry(entry: Omit<WatchEntry, "updatedAt">): void {
  const entries = getContinueWatching();
  const idx = entries.findIndex(
    (e) => e.id === entry.id && e.media_type === entry.media_type
  );
  const newEntry: WatchEntry = { ...entry, updatedAt: Date.now() };
  if (idx !== -1) {
    entries[idx] = newEntry;
  } else {
    entries.unshift(newEntry);
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Storage unavailable or quota exceeded — silently ignore
  }
}

export function removeWatchEntry(id: number, mediaType: "tv" | "movie"): void {
  const entries = getContinueWatching().filter(
    (e) => !(e.id === id && e.media_type === mediaType)
  );
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Storage unavailable — silently ignore
  }
}
