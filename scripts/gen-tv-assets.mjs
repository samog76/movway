/**
 * Generates the Android TV launcher banner and the app icons from inline SVG.
 *
 *   node scripts/gen-tv-assets.mjs
 *
 * Requires `sharp`, which is intentionally NOT a saved dependency — install it
 * on demand (`npm i --no-save sharp`) when regenerating art. Everything this
 * writes is committed, so a normal build never needs it.
 */
import sharp from "sharp";
import { mkdirSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const res = join(root, "android", "app", "src", "main", "res");

const INK = "#0A0A0B";
const ACID = "#CCFF00";
const BONE = "#F4F1EA";
const SANS = "Arial Black, Helvetica Bold, Helvetica, sans-serif";
const MONO = "Menlo, Courier New, monospace";

/** Google TV home-row banner. Spec is 320×180, xhdpi. */
const banner = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180">
  <rect width="320" height="180" fill="${INK}"/>
  <!-- projector glow -->
  <defs>
    <radialGradient id="g" cx="78%" cy="18%" r="70%">
      <stop offset="0%" stop-color="${ACID}" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="${ACID}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="320" height="180" fill="url(#g)"/>
  <!-- marquee bar -->
  <rect x="0" y="0" width="320" height="7" fill="${ACID}"/>
  <!-- film perforations down the left edge -->
  ${Array.from({ length: 9 }, (_, i) => `<circle cx="11" cy="${26 + i * 17}" r="2.1" fill="${BONE}" fill-opacity="0.18"/>`).join("\n  ")}
  <!-- wordmark -->
  <text x="34" y="99" font-family="${SANS}" font-size="43" font-weight="900" letter-spacing="-2" fill="${BONE}">MOV<tspan fill="${ACID}">/</tspan>WAY</text>
  <text x="36" y="123" font-family="${MONO}" font-size="10.5" letter-spacing="4.2" fill="${BONE}" fill-opacity="0.55">SCREENING ROOM</text>
</svg>`;

/** Adaptive-icon foreground: the M/ mark inside the 66% safe zone. */
const iconForeground = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 108 108">
  <text x="54" y="72" text-anchor="middle" font-family="${SANS}" font-size="52" font-weight="900" letter-spacing="-3" fill="${INK}">M<tspan fill="${INK}" fill-opacity="0.55">/</tspan></text>
</svg>`;

/** Legacy square icon: acid ground, ink mark. */
const iconFull = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 108 108">
  <rect width="108" height="108" fill="${ACID}"/>
  <text x="54" y="74" text-anchor="middle" font-family="${SANS}" font-size="58" font-weight="900" letter-spacing="-3" fill="${INK}">M<tspan fill="${INK}" fill-opacity="0.55">/</tspan></text>
</svg>`;

const png = (svg, w, h) =>
  sharp(Buffer.from(svg)).resize(w, h, { fit: "fill" }).png({ compressionLevel: 9 }).toBuffer();

const write = (dir, name, buf) => {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, name), buf);
};

// ── Banner: drawable/ is the fallback, drawable-xhdpi is what TVs pick up ──
const bannerPng = await png(banner, 320, 180);
write(join(res, "drawable"), "tv_banner.png", bannerPng);
write(join(res, "drawable-xhdpi"), "tv_banner.png", bannerPng);

// ── Launcher icons ──
const DENSITIES = [
  ["mdpi", 48, 108],
  ["hdpi", 72, 162],
  ["xhdpi", 96, 216],
  ["xxhdpi", 144, 324],
  ["xxxhdpi", 192, 432],
];

for (const [density, legacy, adaptive] of DENSITIES) {
  const dir = join(res, `mipmap-${density}`);
  const full = await png(iconFull(legacy), legacy, legacy);
  write(dir, "ic_launcher.png", full);
  write(dir, "ic_launcher_round.png", full);
  write(dir, "ic_launcher_foreground.png", await png(iconForeground(adaptive), adaptive, adaptive));
}

console.log("wrote tv_banner.png (320×180) and launcher icons for 5 densities");
