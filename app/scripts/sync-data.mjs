// Copies the data produced by the Python pipeline (members 1, 2, 4) into public/data.
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const app = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(app, "..", "data");
const dst = join(app, "public", "data");

rmSync(dst, { recursive: true, force: true });
mkdirSync(dst, { recursive: true });
for (const [from, to] of [
  ["sites", "sites"],
  ["horizons", "horizons"],
  ["dem/preview", "dem"],
  ["ephemeris", "ephemeris"],
  ["relays", "relays"],
]) {
  const p = join(src, from);
  if (existsSync(p)) cpSync(p, join(dst, to), { recursive: true, filter: (f) => !f.endsWith(".csv") });
}
console.log("Data copied to public/data");
