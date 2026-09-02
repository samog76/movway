import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  normaliseBackendUrl,
  loadBackendUrl,
  saveBackendUrl,
  resolveUrl,
  describeActiveSource,
  effectiveStreamType,
  rankSources,
  isReachableFromPackagedApp,
  movieSourcesUrl,
  episodeSourcesUrl,
  fetchMovieSources,
  type OmssSource,
} from "@/lib/omss";

const src = (o: Partial<OmssSource>): OmssSource => ({
  url: "/v1/proxy?data=x",
  type: "hls",
  quality: "1080p",
  ...o,
});

beforeEach(() => window.localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe("backend address", () => {
  it("tidies what the viewer types", () => {
    expect(normaliseBackendUrl("  http://nas.local:3000/  ")).toBe("http://nas.local:3000");
    expect(normaliseBackendUrl("https://cine.example.com///")).toBe("https://cine.example.com");
  });

  it("assumes http for a bare host, since these run on a home network", () => {
    expect(normaliseBackendUrl("192.168.1.10:3000")).toBe("http://192.168.1.10:3000");
  });

  it("treats an empty setting as no backend at all", () => {
    expect(normaliseBackendUrl("   ")).toBe("");
    expect(loadBackendUrl()).toBe("");
  });

  it("round-trips through storage, and clearing removes it", () => {
    saveBackendUrl("nas.local:3000/");
    expect(loadBackendUrl()).toBe("http://nas.local:3000");
    saveBackendUrl("");
    expect(loadBackendUrl()).toBe("");
  });
});

describe("resolving proxy paths", () => {
  it("puts the backend back in front of a relative path", () => {
    expect(resolveUrl("http://nas.local:3000", "/v1/proxy?data=abc")).toBe(
      "http://nas.local:3000/v1/proxy?data=abc"
    );
  });

  it("leaves an absolute url alone", () => {
    const abs = "https://cdn.example.com/stream.m3u8";
    expect(resolveUrl("http://nas.local:3000", abs)).toBe(abs);
  });

  /**
   * A backend with no PUBLIC_URL set describes its own proxy as localhost.
   * That address means "this machine" to whoever reads it, so on a TV it
   * resolves to the TV, and nothing plays. Settings knows the real one.
   */
  it("re-points a loopback proxy url at the address that reached the backend", () => {
    expect(
      resolveUrl("https://abc.trycloudflare.com", "http://localhost:8099/v1/proxy?data=%7B%22a%22%3A1%7D")
    ).toBe("https://abc.trycloudflare.com/v1/proxy?data=%7B%22a%22%3A1%7D");
  });

  it("treats every loopback spelling the same way", () => {
    for (const host of ["localhost", "127.0.0.1", "0.0.0.0"]) {
      expect(resolveUrl("https://tv.example.com", `http://${host}:8099/v1/proxy?data=x`)).toBe(
        "https://tv.example.com/v1/proxy?data=x"
      );
    }
  });

  it("keeps the query intact, since the proxy carries its payload there", () => {
    const data = "%7B%22url%22%3A%22https%3A%2F%2Ffsharetv.cc%2Fapi%2Fmedia%2Fabc%22%7D";
    expect(resolveUrl("https://abc.trycloudflare.com", `http://localhost:8099/v1/proxy?data=${data}`)).toBe(
      `https://abc.trycloudflare.com/v1/proxy?data=${data}`
    );
  });

  it("does not touch a real upstream host that merely looks local", () => {
    const abs = "https://localhost.cdn.example.com/stream.m3u8";
    expect(resolveUrl("https://abc.trycloudflare.com", abs)).toBe(abs);
  });

  it("leaves a malformed url alone rather than throwing", () => {
    expect(resolveUrl("https://abc.trycloudflare.com", "http://")).toBe("http://");
  });
});

describe("naming the source in play", () => {
  const vix = { url: "/a", type: "hls", quality: "1080p", provider: { name: "VixSrc" } } as const;
  const fshare = { url: "/b", type: "mp4", quality: "720p", provider: { name: "FshareTV" } } as const;

  it("names the provider, the quality and the position", () => {
    expect(describeActiveSource(vix, [vix, fshare])).toBe("VixSrc · 1080p · 1 of 2");
  });

  /**
   * The reason this exists: a failed stream hands over silently, so the second
   * source is what is playing while `sources[0]` still says the first.
   */
  it("names the source that took over, not the one that was tried first", () => {
    expect(describeActiveSource(fshare, [vix, fshare])).toBe("FshareTV · 720p · 2 of 2");
  });

  it("leaves the position off when there is nothing to switch to", () => {
    expect(describeActiveSource(vix, [vix])).toBe("VixSrc · 1080p");
  });

  it("falls back to Direct when the backend names no provider", () => {
    const anon = { url: "/c", type: "hls", quality: "720p" } as const;
    expect(describeActiveSource(anon, [anon])).toBe("Direct · 720p");
  });

  it("says Direct when nothing is playing yet", () => {
    expect(describeActiveSource(undefined, [vix, fshare])).toBe("Direct");
  });

  it("does not claim a position for a source that is not in the list", () => {
    expect(describeActiveSource(vix, [fshare])).toBe("VixSrc · 1080p");
  });
});

describe("believing the stream, not the label", () => {
  const proxied = (upstream: string, declared: OmssSource["type"]) =>
    ({
      url: `https://tun.example.com/v1/proxy?data=${encodeURIComponent(JSON.stringify({ url: upstream }))}`,
      type: declared,
      quality: "1080p",
    }) as OmssSource;

  /**
   * The case that matters: providers announce HLS playlists as mp4, and the
   * declared type decides whether hls.js is used at all. Believing the label
   * makes a good stream fail like a dead link.
   */
  it("corrects an HLS playlist that was announced as mp4", () => {
    expect(effectiveStreamType(proxied("https://vixsrc.to/playlist/1.m3u8", "mp4"))).toBe("hls");
  });

  it("corrects an mp4 that was announced as hls", () => {
    expect(effectiveStreamType(proxied("https://fsharetv.cc/media/a.mp4", "hls"))).toBe("mp4");
  });

  it("ignores the query string when reading the extension", () => {
    expect(
      effectiveStreamType(proxied("https://vixsrc.to/playlist/1.m3u8?token=abc&expires=1", "mp4"))
    ).toBe("hls");
  });

  it("keeps the declared type when the address says nothing", () => {
    expect(effectiveStreamType(proxied("https://cdn.example.com/stream", "hls"))).toBe("hls");
  });

  it("keeps the declared type for a source that is not proxied", () => {
    expect(
      effectiveStreamType({ url: "https://cdn.example.com/a.bin", type: "hls", quality: "720p" } as OmssSource)
    ).toBe("hls");
  });

  it("keeps the declared type when the proxy payload is malformed", () => {
    expect(
      effectiveStreamType({ url: "https://tun.example.com/v1/proxy?data=not-json", type: "mp4", quality: "720p" } as OmssSource)
    ).toBe("mp4");
  });
});

describe("choosing a source", () => {
  it("prefers hls, which is what hls.js can actually play", () => {
    const ranked = rankSources([src({ type: "mkv" }), src({ type: "hls" })]);
    expect(ranked[0].type).toBe("hls");
  });

  it("prefers the highest resolution within a type", () => {
    const ranked = rankSources([
      src({ quality: "480p" }),
      src({ quality: "1080p" }),
      src({ quality: "720p" }),
    ]);
    expect(ranked.map((s) => s.quality)).toEqual(["1080p", "720p", "480p"]);
  });

  it("does not choke on a quality it cannot read", () => {
    const ranked = rankSources([src({ quality: "unknown" }), src({ quality: "720p" })]);
    expect(ranked[0].quality).toBe("720p");
  });
});

describe("endpoints", () => {
  it("builds the documented paths", () => {
    expect(movieSourcesUrl("http://nas.local:3000", 603)).toBe(
      "http://nas.local:3000/v1/movies/603"
    );
    expect(episodeSourcesUrl("http://nas.local:3000", 1399, 2, 5)).toBe(
      "http://nas.local:3000/v1/tv/1399/seasons/2/episodes/5"
    );
  });
});

describe("fetching sources", () => {
  it("returns absolute urls ready to hand to the player", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          responseId: "abc",
          sources: [{ url: "/v1/proxy?data=one", type: "hls", quality: "1080p" }],
          subtitles: [{ url: "/v1/proxy?data=sub", label: "English", format: "vtt" }],
        }),
      })
    );

    const out = await fetchMovieSources("http://nas.local:3000", 603);

    expect(out.sources[0].url).toBe("http://nas.local:3000/v1/proxy?data=one");
    expect(out.subtitles[0].url).toBe("http://nas.local:3000/v1/proxy?data=sub");
  });

  it("surfaces a backend error rather than pretending there are no sources", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 502 }));
    await expect(fetchMovieSources("http://nas.local:3000", 603)).rejects.toThrow("OMSS 502");
  });

  it("tolerates a response with nothing in it", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
    const out = await fetchMovieSources("http://nas.local:3000", 603);
    expect(out.sources).toEqual([]);
    expect(out.subtitles).toEqual([]);
  });
});

describe("addresses the packaged app can actually reach", () => {
  it("accepts https", () => {
    expect(isReachableFromPackagedApp("https://cinepro-core.onrender.com")).toBe(true);
  });

  it("rejects a plain http host, which the TV build blocks as mixed content", () => {
    // The app serves itself from https://localhost with mixed content off, so
    // this fails before a request is made — and works fine in a desktop
    // browser, which is how it stays hidden during development.
    expect(isReachableFromPackagedApp("http://192.168.1.10:3000")).toBe(false);
    expect(isReachableFromPackagedApp("192.168.1.10:3000")).toBe(false);
  });

  it("allows http on localhost, where the platform makes an exception", () => {
    expect(isReachableFromPackagedApp("http://localhost:3000")).toBe(true);
    expect(isReachableFromPackagedApp("http://127.0.0.1:3000")).toBe(true);
  });

  it("treats no address as nothing to reach", () => {
    expect(isReachableFromPackagedApp("")).toBe(false);
  });
});
