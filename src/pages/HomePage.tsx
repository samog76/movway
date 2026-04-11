import { useQuery } from "@tanstack/react-query";
import { getTrending, getPopularMovies, getTopRated, getPopularTV, getUpcoming } from "@/lib/tmdb";
import HeroSection from "@/components/HeroSection";
import ContentRow from "@/components/ContentRow";

export default function HomePage() {
  const { data: trending } = useQuery({ queryKey: ["trending"], queryFn: getTrending });
  const { data: popular } = useQuery({ queryKey: ["popular"], queryFn: getPopularMovies });
  const { data: topRated } = useQuery({ queryKey: ["topRated"], queryFn: getTopRated });
  const { data: tv } = useQuery({ queryKey: ["popularTV"], queryFn: getPopularTV });
  const { data: upcoming } = useQuery({ queryKey: ["upcoming"], queryFn: getUpcoming });

  const hero = trending?.results?.[0] ?? null;

  return (
    <div className="space-y-10">
      <HeroSection movie={hero} />
      {trending && <ContentRow title="Continue Watching" items={trending.results.slice(1, 8)} showDelete />}
      {popular && <ContentRow title="Popular Movies" items={popular.results.slice(0, 10)} />}
      {tv && <ContentRow title="Popular TV Shows" items={tv.results.slice(0, 10)} />}
      {topRated && <ContentRow title="Top Rated" items={topRated.results.slice(0, 10)} />}
      {upcoming && <ContentRow title="Coming Soon" items={upcoming.results.slice(0, 10)} />}
    </div>
  );
}
