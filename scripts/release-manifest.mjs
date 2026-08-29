#!/usr/bin/env node
/**
 * Writes download-site/version.json — what the in-app updater reads to decide
 * whether a newer build exists.
 *
 * It is generated rather than hand-edited because the three version fields and
 * the APK's hash have to agree with the APK actually sitting in download-site/.
 * A manifest that claims a version the APK does not carry sends every device
 * into a download loop: it installs, still reports the old version, and offers
 * the same update again.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const apkPath = join(root, "download-site", "movway.apk");

const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const gradle = readFileSync(join(root, "android/app/build.gradle"), "utf8");

const versionCode = Number(gradle.match(/versionCode\s+(\d+)/)?.[1]);
const versionName = gradle.match(/versionName\s+"([^"]+)"/)?.[1];

if (!Number.isFinite(versionCode)) throw new Error("versionCode not found in build.gradle");
if (versionName !== pkg.version) {
  throw new Error(
    `version mismatch: package.json ${pkg.version} vs build.gradle ${versionName}. ` +
      "Both must move together, along with the chip in download-site/index.html."
  );
}

const apk = readFileSync(apkPath);
const manifest = {
  version: pkg.version,
  versionCode,
  // Served straight from the repo: it is public, it is already where shipping
  // pushes the APK, and it needs no deploy of its own to be current.
  apk: "https://raw.githubusercontent.com/samog76/movway/main/download-site/movway.apk",
  sha256: createHash("sha256").update(apk).digest("hex"),
  size: statSync(apkPath).size,
};

const out = join(root, "download-site", "version.json");
writeFileSync(out, JSON.stringify(manifest, null, 2) + "\n");
console.log(`version.json → ${manifest.version} (code ${manifest.versionCode}), ${manifest.size} bytes`);
console.log(`sha256 ${manifest.sha256}`);
