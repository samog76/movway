const TMDB_API_KEY = "2dca580c2a14b55200e784d157207b4d";
const BASE = "https://api.themoviedb.org/3";
const IMG = "https://image.tmdb.org/t/p";

export const img = (path: string | null, size = "w500") =>
  path ? `${IMG}/${size}${path}` : "/placeholder.svg";

export const backdrop = (path: string | null) => img(path, "original");

async function tmdb<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${BASE}${endpoint}`);
  url.searchParams.set("api_key", TMDB_API_KEY);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  return res.json();
}

export interface Movie {
  id: number;
  title: string;
  name?: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  media_type?: string;
  release_date?: string;
  first_air_date?: string;
}

interface TmdbList { results: Movie[]; }

export const getTrending = () => tmdb<TmdbList>("/trending/all/week");
export const getPopularMovies = () => tmdb<TmdbList>("/movie/popular");
export const getTopRated = () => tmdb<TmdbList>("/movie/top_rated");
export const getPopularTV = () => tmdb<TmdbList>("/tv/popular");
export const getUpcoming = () => tmdb<TmdbList>("/movie/upcoming");
export const searchMulti = (query: string) => tmdb<TmdbList>("/search/multi", { query });

export const getMovieDetails = (id: number) => tmdb<Movie & { genres: { id: number; name: string }[]; runtime: number }>(`/movie/${id}`);
export const getTVDetails = (id: number) => tmdb<Movie & { genres: { id: number; name: string }[]; number_of_seasons: number }>(`/tv/${id}`);

export const playerUrl = {
  movie: (tmdbId: number) => `https://vidsrc-embed.ru/embed/movie/${tmdbId}`,
  tv: (tmdbId: number, season: number, episode: number) =>
    `https://vidsrc-embed.ru/embed/tv/${tmdbId}/${season}/${episode}`,
};

const ensurePageNumber = (page: number) => {
  if (!Number.isInteger(page) || page < 1) {
    throw new Error("Page number is required and must be a positive integer");
  }
  return page;
};

export const latestListUrl = {
  movies: (page: number) =>
    `https://vidsrc-embed.ru/movies/latest/page-${ensurePageNumber(page)}.json`,
  tvShows: (page: number) =>
    `https://vidsrc-embed.ru/movies/latest/page-${ensurePageNumber(page)}.json`,
  episodes: (page: number) =>
    `https://vidsrc-embed.ru/episodes/latest/page-${ensurePageNumber(page)}.json`,
};
