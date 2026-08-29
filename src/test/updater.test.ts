import { describe, it, expect, beforeEach } from "vitest";
import {
  DEFAULT_MANIFEST_URL,
  compareVersions,
  isNewer,
  loadManifestUrl,
  parseManifest,
  saveManifestUrl,
} from "@/lib/updater";

beforeEach(() => window.localStorage.clear());

describe("comparing versions", () => {
  /**
   * The case that matters: string order puts "1.10.0" before "1.9.0", which
   * would tell a device on 1.9.0 it was current forever.
   */
  it("orders by number, not by string", () => {
    expect(compareVersions("1.10.0", "1.9.0")).toBeGreaterThan(0);
    expect(compareVersions("1.9.0", "1.10.0")).toBeLessThan(0);
  });

  it("treats equal versions as equal", () => {
    expect(compareVersions("1.8.0", "1.8.0")).toBe(0);
    expect(compareVersions("v1.8.0", "1.8.0")).toBe(0);
  });

  it("reads a missing segment as zero", () => {
    expect(compareVersions("1.8", "1.8.0")).toBe(0);
    expect(compareVersions("2", "1.9.9")).toBeGreaterThan(0);
  });

  it("does not choke on rubbish", () => {
    expect(compareVersions("", "")).toBe(0);
    expect(compareVersions("1.8.0", "not-a-version")).toBeGreaterThan(0);
  });
});

describe("reading a manifest", () => {
  const good = {
    version: "1.9.0",
    versionCode: 21,
    apk: "https://raw.githubusercontent.com/samog76/movway/main/download-site/movway.apk",
    sha256: "a".repeat(64),
    size: 3575611,
  };

  it("accepts the shape the release script writes", () => {
    expect(parseManifest(good)).toEqual(good);
  });

  /**
   * This ends in an installed application, so an address that is not https is
   * refused outright rather than downloaded and checked afterwards.
   */
  it("refuses a download that is not over https", () => {
    expect(parseManifest({ ...good, apk: "http://example.com/movway.apk" })).toBeNull();
  });

  it("refuses a manifest with nothing to fetch", () => {
    expect(parseManifest({ version: "1.9.0" })).toBeNull();
    expect(parseManifest({ apk: "https://example.com/a.apk" })).toBeNull();
    expect(parseManifest(null)).toBeNull();
    expect(parseManifest("1.9.0")).toBeNull();
  });

  // A malformed hash is dropped rather than carried through, so verification
  // is either done properly or not claimed at all.
  it("ignores a hash that is not a sha256", () => {
    expect(parseManifest({ ...good, sha256: "abc" })?.sha256).toBeUndefined();
  });

  it("survives a manifest with no version code", () => {
    const parsed = parseManifest({ version: "1.9.0", apk: good.apk });
    expect(parsed?.versionCode).toBe(0);
  });
});

describe("deciding whether to offer an update", () => {
  const manifest = parseManifest({
    version: "1.9.0",
    versionCode: 21,
    apk: "https://example.com/movway.apk",
  })!;

  it("prefers the version code, which is what Android orders installs by", () => {
    expect(isNewer(manifest, { version: "1.9.0", versionCode: 20 })).toBe(true);
    expect(isNewer(manifest, { version: "0.1.0", versionCode: 21 })).toBe(false);
  });

  it("falls back to the version name when there is no code", () => {
    expect(isNewer({ ...manifest, versionCode: 0 }, { version: "1.8.0", versionCode: 0 })).toBe(true);
    expect(isNewer({ ...manifest, versionCode: 0 }, { version: "1.9.0", versionCode: 0 })).toBe(false);
  });

  it("never offers the build already installed", () => {
    expect(isNewer(manifest, { version: "1.9.0", versionCode: 21 })).toBe(false);
  });
});

describe("where updates are taken from", () => {
  it("defaults to the published build", () => {
    expect(loadManifestUrl()).toBe(DEFAULT_MANIFEST_URL);
  });

  it("remembers somewhere else", () => {
    saveManifestUrl("https://example.com/version.json");
    expect(loadManifestUrl()).toBe("https://example.com/version.json");
  });

  it("treats empty as back to the default", () => {
    saveManifestUrl("https://example.com/version.json");
    saveManifestUrl("   ");
    expect(loadManifestUrl()).toBe(DEFAULT_MANIFEST_URL);
  });
});
