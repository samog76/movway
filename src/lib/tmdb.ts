const TMDB_API_KEY =
  (import.meta.env.VITE_TMDB_API_KEY as string | undefined) ||
  "2dca580c2a14b55200e784d157207b4d";
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
export const getTrendingMovies = () => tmdb<TmdbList>("/trending/movie/week");
export const getTrendingTV = () => tmdb<TmdbList>("/trending/tv/week");
export const getPopularMovies = () => tmdb<TmdbList>("/movie/popular");
export const getTopRated = () => tmdb<TmdbList>("/movie/top_rated");
export const getPopularTV = () => tmdb<TmdbList>("/tv/popular");
export const getUpcoming = () => tmdb<TmdbList>("/movie/upcoming");
export const searchMulti = (query: string) => tmdb<TmdbList>("/search/multi", { query });
export const getAnime = () => tmdb<TmdbList>("/discover/tv", { with_genres: "16" });

export interface MovieDetails extends Movie {
  genres: { id: number; name: string }[];
  runtime: number;
  imdb_id: string | null;
}

export interface TVDetails extends Movie {
  genres: { id: number; name: string }[];
  number_of_seasons: number;
  external_ids?: { imdb_id: string | null };
}

export const getMovieDetails = (id: number) =>
  tmdb<MovieDetails>(`/movie/${id}`, { append_to_response: "external_ids" });
export const getTVDetails = (id: number) =>
  tmdb<TVDetails>(`/tv/${id}`, { append_to_response: "external_ids" });

export interface CastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
}

export interface Credits { cast: CastMember[] }

export const getMovieCredits = (id: number) => tmdb<Credits>(`/movie/${id}/credits`);
export const getTVCredits = (id: number) => tmdb<Credits>(`/tv/${id}/credits`);

export type MoviePlayerProviderId =
  | "vidsrc"
  | "fsapi"
  | "curtstream"
  | "moviewp"
  | "apimdb"
  | "gomo"
  | "vidcloud"
  | "getsuperembed";

export type TVPlayerProviderId =
  | "fsapi"
  | "moviewp"
  | "apimdb"
  | "databasegdriveplayer"
  | "curtstream"
  | "getsuperembed";

export const moviePlayerProviders: { id: MoviePlayerProviderId; label: string }[] = [
  { id: "vidsrc", label: "Vidsrc" },
  { id: "fsapi", label: "FSAPI" },
  { id: "curtstream", label: "CurtStream" },
  { id: "moviewp", label: "MovieWP" },
  { id: "apimdb", label: "APIIMDb v2" },
  { id: "gomo", label: "Gomo" },
  { id: "vidcloud", label: "VidCloud" },
  { id: "getsuperembed", label: "GetSuperEmbed" },
];

export const tvPlayerProviders: { id: TVPlayerProviderId; label: string }[] = [
  { id: "fsapi", label: "FSAPI" },
  { id: "moviewp", label: "MovieWP" },
  { id: "apimdb", label: "APIIMDb v2" },
  { id: "databasegdriveplayer", label: "DatabaseGDrivePlayer" },
  { id: "curtstream", label: "CurtStream" },
  { id: "getsuperembed", label: "GetSuperEmbed" },
];

export const DEFAULT_MOVIE_PLAYER_PROVIDER: MoviePlayerProviderId = "vidsrc";
export const DEFAULT_TV_PLAYER_PROVIDER: TVPlayerProviderId = "fsapi";

export function buildMoviePlayerUrl(provider: MoviePlayerProviderId, imdbId: string): string {
  const encodedImdbId = encodeURIComponent(imdbId);
  switch (provider) {
    case "vidsrc":
      return `https://vidsrc.me/embed/${encodedImdbId}/`;
    case "fsapi":
      return `https://fsapi.xyz/movie/${encodedImdbId}`;
    case "curtstream":
      return `https://curtstream.com/movies/imdb/${encodedImdbId}`;
    case "moviewp":
      return `https://moviewp.com/se.php?video_id=${encodedImdbId}`;
    case "apimdb":
      return `https://v2.apimdb.net/e/movie/${encodedImdbId}`;
    case "gomo":
      return `https://gomo.to/movie/${encodedImdbId}`;
    case "vidcloud":
      return `https://vidcloud.stream/${encodedImdbId}.html`;
    case "getsuperembed":
      return `https://getsuperembed.link/?video_id=${encodedImdbId}`;
  }
}

export function buildTVPlayerUrl(
  provider: TVPlayerProviderId,
  tmdbId: number,
  season: number,
  episode: number,
  imdbId?: string | null
): string | null {
  const encodedSeason = encodeURIComponent(String(season));
  const encodedEpisode = encodeURIComponent(String(episode));
  const encodedTmdbId = encodeURIComponent(String(tmdbId));
  const encodedImdbId = imdbId ? encodeURIComponent(imdbId) : null;

  switch (provider) {
    case "fsapi":
      return encodedImdbId ? `https://fsapi.xyz/tv-imdb/${encodedImdbId}-${encodedSeason}-${encodedEpisode}` : null;
    case "moviewp":
      return `https://moviewp.com/se.php?video_id=${encodedTmdbId}&tmdb=1&s=${encodedSeason}&e=${encodedEpisode}`;
    case "apimdb":
      return `https://v2.apimdb.net/e/tmdb/tv/${encodedTmdbId}/${encodedSeason}/${encodedEpisode}/`;
    case "databasegdriveplayer":
      return `https://databasegdriveplayer.co/player.php?type=series&tmdb=${encodedTmdbId}&season=${encodedSeason}&episode=${encodedEpisode}`;
    case "curtstream":
      return `https://curtstream.com/series/tmdb/${encodedTmdbId}/${encodedSeason}/${encodedEpisode}/`;
    case "getsuperembed":
      return encodedImdbId
        ? `https://getsuperembed.link/?video_id=${encodedImdbId}&season=${encodedSeason}&episode=${encodedEpisode}`
        : null;
  }
}
