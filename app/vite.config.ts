import { cpSync, createReadStream, existsSync, statSync } from "node:fs";
import { dirname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Connect, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const here = dirname(fileURLToPath(import.meta.url));
// Relief multi-résolution produit par scripts/build_tiles.py (~750 Mo) : servi tel quel,
// sans copie dans public/, sous l'URL data/tiles/…
const TILES_DIR = resolve(here, "..", "data", "dem", "tiles");
// Cartes d'horizon régionales (scripts/build_horizon_maps.py), pour l'optimisation de zones
const MAPS_DIR = resolve(here, "..", "data", "horizon_maps");
const MOUNTS: [string, string][] = [["/data/tiles/", TILES_DIR], ["/data/horizon_maps/", MAPS_DIR]];

function tilesMiddleware(): Connect.NextHandleFunction {
  return (req, res, next) => {
    const url = (req.url ?? "").split("?")[0];
    const mount = MOUNTS.find(([p]) => url.startsWith(p));
    if (!mount) return next();
    const [prefix, dir] = mount;
    const rel = normalize(decodeURIComponent(url.slice(prefix.length)));
    const file = join(dir, rel);
    if (!file.startsWith(dir) || !existsSync(file) || !statSync(file).isFile()) {
      res.statusCode = 404; // tuile absente = pas de donnée à ce niveau
      res.end();
      return;
    }
    res.setHeader("Content-Type", file.endsWith(".json") ? "application/json" : "application/octet-stream");
    // Index / métadonnées : toujours revalidés (ils changent quand on regénère) ; binaires : cache 1 h
    res.setHeader("Cache-Control", file.endsWith(".json") ? "no-cache" : "public, max-age=3600");
    createReadStream(file).pipe(res);
  };
}

function demTiles(noTiles: boolean): Plugin {
  return {
    name: "dem-tiles",
    configureServer(server) { server.middlewares.use(tilesMiddleware()); },
    configurePreviewServer(server) { server.middlewares.use(tilesMiddleware()); },
    closeBundle() {
      // Build : copie la pyramide à côté de l'application (désactivable avec NO_TILES=1 ou --mode web)
      if (existsSync(MAPS_DIR)) cpSync(MAPS_DIR, resolve(here, "dist", "data", "horizon_maps"), { recursive: true });
      if (noTiles || !existsSync(TILES_DIR)) return;
      cpSync(TILES_DIR, resolve(here, "dist", "data", "tiles"), { recursive: true });
    },
  };
}

// Mode "web" (npm run build:web) : version à héberger, sans la pyramide de 750 Mo ;
// l'application se rabat alors sur le MNT réduit à 1,2 km pour les sites personnalisés.
export default defineConfig(({ mode }) => ({
  plugins: [react(), demTiles(Boolean(process.env.NO_TILES) || mode === "web")],
  base: "./",
  server: { port: 5173 },
}));
