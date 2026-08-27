import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * The packaged app serves from https://localhost, so TMDB calls are made by the
 * platform rather than the WebView. These cover that branch — it is the one
 * that only runs on a device, so it is the one most easily broken unnoticed.
 */
const isNativePlatform = vi.fn();
const get = vi.fn();

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => isNativePlatform() },
  CapacitorHttp: { get: (opts: unknown) => get(opts) },
}));

beforeEach(() => {
  vi.resetModules();
  isNativePlatform.mockReset();
  get.mockReset();
});

afterEach(() => vi.unstubAllGlobals());

describe("TMDB requests on a device", () => {
  it("goes through native HTTP instead of the WebView's fetch", async () => {
    isNativePlatform.mockReturnValue(true);
    get.mockResolvedValue({ status: 200, data: { results: [] } });
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const { getTrending } = await import("@/lib/tmdb");
    await getTrending();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(get).toHaveBeenCalledTimes(1);
    const url = new URL(get.mock.calls[0][0].url);
    expect(url.host).toBe("api.themoviedb.org");
    expect(url.searchParams.get("api_key")).toBeTruthy();
  });

  it("parses a JSON body the bridge handed back as a string", async () => {
    isNativePlatform.mockReturnValue(true);
    get.mockResolvedValue({ status: 200, data: JSON.stringify({ results: [{ id: 7 }] }) });

    const { getTrending } = await import("@/lib/tmdb");
    await expect(getTrending()).resolves.toEqual({ results: [{ id: 7 }] });
  });

  it("surfaces a non-2xx native status the same way fetch would", async () => {
    isNativePlatform.mockReturnValue(true);
    get.mockResolvedValue({ status: 401, data: "" });

    const { getTrending } = await import("@/lib/tmdb");
    await expect(getTrending()).rejects.toThrow("TMDB 401");
  });

  it("still uses plain fetch in the browser", async () => {
    isNativePlatform.mockReturnValue(false);
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results: [] }) });
    vi.stubGlobal("fetch", fetchSpy);

    const { getTrending } = await import("@/lib/tmdb");
    await getTrending();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(get).not.toHaveBeenCalled();
  });
});
