const TMDB_API_KEY = "2dca580c2a14b55200e784d157207b4d";
const BASE = "https://api.themoviedb.org/3";
const IMG = "https://image.tmdb.org/t/p";
const DEFAULT_IMAGE = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

export const img = (path: string | null, size = "w500") =>
  path
    ? `${IMG}/${size}${path}`
    : DEFAULT_IMAGE;

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
export const getAnime = () => tmdb<TmdbList>("/discover/tv", { with_genres: "16" });

export const getMovieDetails = (id: number) => tmdb<Movie & { genres: { id: number; name: string }[]; runtime: number }>(`/movie/${id}`);
export const getTVDetails = (id: number) => tmdb<Movie & { genres: { id: number; name: string }[]; number_of_seasons: number }>(`/tv/${id}`);

export interface CastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
}

export interface Credits { cast: CastMember[] }

export const getMovieCredits = (id: number) => tmdb<Credits>(`/movie/${id}/credits`);
export const getTVCredits = (id: number) => tmdb<Credits>(`/tv/${id}/credits`);

export const playerUrl = {
  movie: (tmdbId: number) => `https://vidsrc-embed.ru/embed/movie/${tmdbId}`,
  tv: (tmdbId: number, season: number, episode: number) =>
    `https://vidsrc-embed.ru/embed/tv/${tmdbId}/${season}/${episode}`,
  anime: (anilistId: number, ep: number, dub = false) =>
    `https://player.vidplus.to/embed/anime/${anilistId}/${ep}?dub=${dub}`,
};
