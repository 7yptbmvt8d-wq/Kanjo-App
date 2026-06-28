// One-shot: extract the base64 logos embedded in the legacy prototype JSX
// and write them as standalone files so PWA tooling and Firebase Hosting can
// serve them directly.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const source = readFileSync(resolve(root, "src/CostaVerdeApp.jsx"), "utf8");

function extract(constant) {
  const re = new RegExp(
    `const\\s+${constant}\\s*=\\s*"data:image\\/(jpe?g|png);base64,([^"]+)"`,
  );
  const m = source.match(re);
  if (!m) throw new Error(`Could not find ${constant} in source`);
  return { ext: m[1].replace("jpeg", "jpg"), b64: m[2] };
}

const outDir = resolve(root, "public/branding");
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

for (const [name, key] of [
  ["logo-costa-verde", "LOGO_COSTA_VERDE"],
  ["logo-ffab", "LOGO_FFAB"],
]) {
  const { ext, b64 } = extract(key);
  const path = resolve(outDir, `${name}.${ext}`);
  writeFileSync(path, Buffer.from(b64, "base64"));
  console.log(`wrote ${path}`);
}
