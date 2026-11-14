import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { latLonToXY } from "../astro/horizon";
import { rasterizeRegions, type ArtemisRegionSet } from "../astro/regions";
import { mapsBaseUrl, runRegion } from "../optim/client";
import type { RegionMetrics } from "../optim/evaluate";
import { loadRegion, loadRegionIndex, pixelLatLon, type RegionData, type RegionIndexEntry } from "../optim/region";
import { CRITERIA, extractZones, ICE_RANGE_KM, NO_PSR_LIMIT, PROFILES, scoreRegion, type Constraints, type Criterion } from "../optim/score";
import type { SiteRecord } from "../data";
import { fmtDate, fmtDeg, fmtDuration, fmtLatLon, fmtNum, fmtPct } from "../format";

type Layer = "score" | "sun" | "night" | "earth" | "both" | "slope" | "psr";
const LAYERS: { id: Layer; label: string }[] = [
  { id: "score", label: "Score" }, { id: "sun", label: "Soleil %" }, { id: "night", label: "Plus longue nuit" },
  { id: "earth", label: "Terre %" }, { id: "both", label: "Soleil + Terre %" }, { id: "slope", label: "Pente" },
  { id: "psr", label: "Ombre permanente" },
];
const STATIC_LAYERS: Layer[] = ["slope", "psr"];

// Perceptual ramp (dark violet → blue → teal → green → yellow), readable on dark backgrounds
const RAMP = [[48, 18, 59], [50, 101, 176], [33, 162, 160], [122, 200, 80], [248, 230, 33]];
function ramp(t: number): [number, number, number] {
  const x = Math.min(1, Math.max(0, t)) * (RAMP.length - 1);
  const i = Math.min(RAMP.length - 2, Math.floor(x)), f = x - i;
  return [0, 1, 2].map((k) => RAMP[i][k] * (1 - f) + RAMP[i + 1][k] * f) as [number, number, number];
}

interface Props {
  start: number;
  hours: number;
  sites: SiteRecord[];
  onAnalyze: (lat: number, lon: number) => void;
  artemis?: ArtemisRegionSet | null;
}

export function Optimizer({ start, hours, sites, onAnalyze, artemis }: Props) {
  const [index, setIndex] = useState<RegionIndexEntry[] | null>(null);
  const [regionId, setRegionId] = useState("");
  const [region, setRegion] = useState<RegionData | null>(null);
  const [metrics, setMetrics] = useState<RegionMetrics | null>(null);
  const [ranFor, setRanFor] = useState<{ start: number; hours: number; region: string } | null>(null);
  const [progress, setProgress] = useState<{ phase: string; f: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [profileId, setProfileId] = useState(PROFILES[0].id);
  const [weights, setWeights] = useState<Record<Criterion, number>>(PROFILES[0].weights);
  const [cons, setCons] = useState<Constraints>(PROFILES[0].constraints);
  const [tolerance, setTolerance] = useState(3);
  const [layer, setLayer] = useState<Layer>("score");
  const [picked, setPicked] = useState<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    loadRegionIndex(mapsBaseUrl()).then((ix) => { setIndex(ix); setRegionId(ix[0]?.id ?? ""); })
      .catch(() => setError("Cartes d'horizon introuvables : lancez scripts/build_horizon_maps.py."));
  }, []);

  const entry = index?.find((r) => r.id === regionId);
  useEffect(() => {
    if (!entry) return;
    setRegion(null); setMetrics(null); setPicked(null);
    loadRegion(mapsBaseUrl(), entry.file, false).then(setRegion).catch((e) => setError(String(e)));
  }, [entry]);

  const run = () => {
    if (!entry) return;
    setError(null); setProgress({ phase: "load", f: 0 });
    runRegion(entry.file, start, hours, (phase, f) => setProgress({ phase, f }))
      .then((m) => { setMetrics(m); setRanFor({ start, hours, region: entry.id }); setProgress(null); })
      .catch((e) => { setError(String(e)); setProgress(null); });
  };

  // Official Artemis III regions rasterized onto the regional grid
  const a3 = useMemo(() => (region && artemis
    ? { mask: rasterizeRegions(artemis, region.meta), names: artemis.regions.map((r) => r.name) } : null), [region, artemis]);
  const a3Pixels = useMemo(() => (a3 ? a3.mask.reduce((n, v) => n + (v ? 1 : 0), 0) : 0), [a3]);
  const scored = useMemo(() => (region && metrics ? scoreRegion(region, metrics, weights, cons, a3?.mask) : null),
    [region, metrics, weights, cons, a3]);
  const zones = useMemo(() => (region && metrics && scored && scored.feasibleCount
    ? extractZones(region, metrics, scored, tolerance, 6, a3 ?? undefined) : []), [region, metrics, scored, tolerance, a3]);

  // Shaded relief background (computed once per region)
  const shade = useMemo(() => {
    if (!region) return null;
    const { width: W, height: H, pixel_m } = region.meta;
    const s = new Float32Array(W * H);
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
      const p = r * W + c;
      const e = (dc: number, dr: number) => region.elev[Math.min(H - 1, Math.max(0, r + dr)) * W + Math.min(W - 1, Math.max(0, c + dc))];
      const gx = (e(1, 0) - e(-1, 0)) / (2 * pixel_m), gy = (e(0, -1) - e(0, 1)) / (2 * pixel_m);
      s[p] = Math.max(0, (-gx * -0.5 - gy * 0.5 + 0.7) / (Math.hypot(gx, gy, 1) * 0.995));
    }
    return s;
  }, [region]);

  const layerValues = useMemo(() => {
    if (!region) return null;
    const N = region.meta.width * region.meta.height;
    const v = new Float32Array(N);
    let lo = Infinity, hi = -Infinity;
    for (let p = 0; p < N; p++) {
      let x: number;
      if (layer === "slope") x = region.slopeMean[p] / 10;
      else if (layer === "psr") x = region.psrDistKm.length ? Math.min(region.psrDistKm[p], ICE_RANGE_KM) : NaN;
      else if (!metrics) { v[p] = NaN; continue; }
      else if (layer === "score") x = scored ? scored.score[p] : NaN;
      else if (layer === "sun") x = metrics.sunPct[p];
      else if (layer === "night") x = metrics.nightH[p];
      else if (layer === "earth") x = metrics.earthPct[p];
      else x = metrics.bothPct[p];
      v[p] = x;
      if (!Number.isNaN(x)) { lo = Math.min(lo, x); hi = Math.max(hi, x); }
    }
    if (layer === "sun" || layer === "earth" || layer === "both") { lo = 0; hi = 100; }
    if (layer === "psr") { lo = 0; hi = ICE_RANGE_KM; }
    return { v, lo, hi, invert: layer === "night" || layer === "slope" || layer === "psr" };
  }, [region, metrics, scored, layer]);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !region || !shade || !layerValues) return;
    const { width: W, height: H } = region.meta;
    const img = ctx.createImageData(W, H);
    const { v, lo, hi, invert } = layerValues;
    for (let p = 0; p < W * H; p++) {
      const g = 25 + 150 * shade[p];
      let rgb: [number, number, number] = [g, g, g];
      const x = v[p];
      const isStatic = STATIC_LAYERS.includes(layer);
      const feasible = !scored || scored.feasible[p] || isStatic;
      if (!Number.isNaN(x) && feasible) {
        let t = hi > lo ? (x - lo) / (hi - lo) : 0.5;
        if (invert) t = 1 - t;
        const c = ramp(t);
        rgb = [0.25 * g + 0.75 * c[0], 0.25 * g + 0.75 * c[1], 0.25 * g + 0.75 * c[2]];
      } else if (scored && !scored.feasible[p] && !isStatic && metrics) {
        rgb = [g * 0.45, g * 0.45, g * 0.5];
      }
      if (region.psr[p]) rgb = [12, 40 + 0.25 * g, 120 + 0.4 * g]; // permanent shadow: blue
      img.data.set([rgb[0], rgb[1], rgb[2], 255], p * 4);
    }
    ctx.putImageData(img, 0, 0);
    const m = region.meta;
    const toPx = (lat: number, lon: number) => {
      const [x, y] = latLonToXY(lat, lon);
      return [(x - m.x_min_m) / m.pixel_m, (m.y_max_m - y) / m.pixel_m];
    };
    if (artemis) {
      ctx.save();
      ctx.strokeStyle = "#5ad1e6"; ctx.lineWidth = 1.5; ctx.setLineDash([5, 3]);
      ctx.font = "10px system-ui, sans-serif"; ctx.fillStyle = "#a6ecf7"; ctx.textAlign = "center";
      for (const r of artemis.regions) {
        ctx.beginPath();
        r.xy.forEach(([x, y], i) => {
          const px = (x - m.x_min_m) / m.pixel_m, py = (m.y_max_m - y) / m.pixel_m;
          if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
        });
        ctx.closePath(); ctx.stroke();
        const lx = (r.center[0] - m.x_min_m) / m.pixel_m, ly = (m.y_max_m - r.center[1]) / m.pixel_m;
        if (lx > 0 && ly > 0 && lx < W && ly < H) ctx.fillText(r.name, lx, ly);
      }
      ctx.restore();
    }
    ctx.font = "bold 11px system-ui, sans-serif";
    for (const s of sites) {
      if (!s.in_dem || s.category === "custom") continue;
      const [cx, cy] = toPx(s.lat, s.lon);
      if (cx < 0 || cy < 0 || cx >= W || cy >= H) continue;
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(cx - 5, cy - 5); ctx.lineTo(cx + 5, cy + 5); ctx.moveTo(cx + 5, cy - 5); ctx.lineTo(cx - 5, cy + 5); ctx.stroke();
      ctx.fillStyle = "#fff"; ctx.fillText(s.short, cx + 7, cy + 4);
    }
    for (const z of zones) {
      ctx.beginPath(); ctx.arc(z.bestCol, z.bestRow, 7, 0, 2 * Math.PI);
      ctx.fillStyle = "#e06cf0"; ctx.fill(); ctx.strokeStyle = "#05070d"; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = "#05070d"; ctx.textAlign = "center"; ctx.fillText(String(z.rank), z.bestCol, z.bestRow + 4); ctx.textAlign = "start";
    }
    if (picked !== null) {
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 2;
      ctx.strokeRect((picked % W) - 4, Math.floor(picked / W) - 4, 9, 9);
    }
  }, [region, shade, layerValues, scored, zones, sites, picked, layer, metrics, artemis]);

  const click = (e: MouseEvent<HTMLCanvasElement>) => {
    if (!region) return;
    const r = e.currentTarget.getBoundingClientRect();
    const c = Math.floor(((e.clientX - r.left) / r.width) * region.meta.width);
    const rr = Math.floor(((e.clientY - r.top) / r.height) * region.meta.height);
    setPicked(rr * region.meta.width + c);
  };

  const applyProfile = (id: string) => {
    const p = PROFILES.find((x) => x.id === id)!;
    setProfileId(id); setWeights(p.weights); setCons(p.constraints);
  };
  const setW = (k: Criterion, v: number) => { setWeights({ ...weights, [k]: v }); setProfileId("custom"); };
  const setC = (k: keyof Constraints, v: number) => { setCons({ ...cons, [k]: v }); setProfileId("custom"); };

  const stale = ranFor && (ranFor.start !== start || ranFor.hours !== hours || ranFor.region !== regionId);
  const pickedInfo = picked !== null && region ? (() => {
    const W = region.meta.width;
    const [lat, lon] = pixelLatLon(region.meta, picked % W, Math.floor(picked / W));
    return { lat, lon, p: picked };
  })() : null;
  const fmtLegend = (x: number) => layer === "night" ? fmtDuration(x) : layer === "slope" ? fmtDeg(x)
    : layer === "psr" ? `${fmtNum(x)} km` : fmtNum(x);

  if (error && !index) return <p className="muted">{error}</p>;
  return (
    <div className="optim">
      <div className="optim-controls">
        <label>Région
          <select value={regionId} onChange={(e) => setRegionId(e.target.value)}>
            {index?.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </label>
        <div className="optim-period">
          Période : <b>{fmtDate(start)}</b> · {fmtDuration(hours)}
          <span className="muted"> (réglée en haut de page)</span>
        </div>
        <button className="primary" onClick={run} disabled={!region || !!progress}>
          {progress ? "Calcul en cours…" : metrics && !stale ? "Relancer" : "Lancer l'analyse de la région"}
        </button>
        {progress && (
          <div className="progress"><div style={{ width: `${Math.round(progress.f * 100)}%` }} />
            <span>{progress.phase === "load" ? "Chargement des cartes d'horizon…" : `Simulation ${Math.round(progress.f * 100)} %`}</span>
          </div>
        )}
        {stale && !progress && <span className="warn">La période ou la région a changé : relancez l'analyse.</span>}
        {error && index && <span className="warn">{error}</span>}
      </div>

      <div className="optim-body">
        <div className="optim-map">
          <div className="seg">
            {LAYERS.map((l) => (
              <button key={l.id} className={l.id === layer ? "on" : ""} onClick={() => setLayer(l.id)}
                disabled={!metrics && !STATIC_LAYERS.includes(l.id)}>{l.label}</button>
            ))}
          </div>
          {region ? (
            <canvas ref={canvasRef} width={region.meta.width} height={region.meta.height} onClick={click}
              title="Cliquer sur un point pour voir ses valeurs" />
          ) : <div className="map-placeholder">Chargement de la région…</div>}
          {layerValues && Number.isFinite(layerValues.lo) && (
            <div className="ramp-legend">
              <span>{fmtLegend(layerValues.invert ? layerValues.hi : layerValues.lo)}</span>
              <i style={{ background: `linear-gradient(90deg, ${RAMP.map((c) => `rgb(${c.join(",")})`).join(",")})` }} />
              <span>{fmtLegend(layerValues.invert ? layerValues.lo : layerValues.hi)}</span>
              <span className="muted">{layerValues.invert ? "(à gauche : défavorable)" : ""}</span>
            </div>
          )}
          <p className="hint">Pointillés cyan : régions candidates Artemis III (NASA 2022). Bleu : ombre permanente (le Soleil n'y entre jamais ; glace d'eau possible). Gris foncé : hors contraintes. ✕ : sites étudiés. Pastilles violettes : meilleures zones.
            {region && ` Pixels de ${region.meta.pixel_m} m, horizon sur 72 directions.`}</p>
        </div>

        <div className="optim-side">
          <h4>Profil de mission</h4>
          <select value={profileId} onChange={(e) => applyProfile(e.target.value)}>
            {PROFILES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          <p className="hint">{PROFILES.find((p) => p.id === profileId)?.description}</p>

          <h4>Poids des critères</h4>
          {CRITERIA.map((c) => (
            <label key={c.id} className="slider" title={c.hint}>
              <span>{c.label}</span>
              <input type="range" min={0} max={5} step={1} value={weights[c.id]} onChange={(e) => setW(c.id, +e.target.value)} />
              <b>{weights[c.id]}</b>
            </label>
          ))}

          <h4>Contraintes</h4>
          <label className="slider"><span>Pente moy. max</span>
            <input type="range" min={2} max={30} step={1} value={cons.slopeMax} onChange={(e) => setC("slopeMax", +e.target.value)} />
            <b>{cons.slopeMax}°</b></label>
          <label className="slider"><span>Nuit max</span>
            <input type="range" min={0} max={Math.ceil(hours)} step={6} value={Math.min(cons.nightMaxH, Math.ceil(hours))}
              onChange={(e) => setC("nightMaxH", +e.target.value)} />
            <b>{cons.nightMaxH >= hours ? "—" : fmtDuration(cons.nightMaxH)}</b></label>
          <label className="slider"><span>Terre min</span>
            <input type="range" min={0} max={100} step={5} value={cons.earthMinPct} onChange={(e) => setC("earthMinPct", +e.target.value)} />
            <b>{cons.earthMinPct} %</b></label>
          <label className="slider"><span>Soleil min</span>
            <input type="range" min={0} max={100} step={5} value={cons.sunMinPct} onChange={(e) => setC("sunMinPct", +e.target.value)} />
            <b>{cons.sunMinPct} %</b></label>
          <label className="slider" title="Distance maximale à une zone d'ombre permanente (pièges froids)"><span>Ombre perm. max</span>
            <input type="range" min={0.5} max={NO_PSR_LIMIT} step={0.5} value={cons.psrMaxKm ?? NO_PSR_LIMIT} onChange={(e) => setC("psrMaxKm", +e.target.value)} />
            <b>{(cons.psrMaxKm ?? NO_PSR_LIMIT) >= NO_PSR_LIMIT ? "—" : `${fmtNum(cons.psrMaxKm, 1)} km`}</b></label>
          {artemis && (
            <label className="check" title="Ne garder que les points situés dans une région candidate officielle (liste NASA 2022)">
              <input type="checkbox" checked={!!cons.onlyArtemis} onChange={(e) => setCons({ ...cons, onlyArtemis: e.target.checked })} />
              Seulement dans les régions Artemis III
              <span className="muted"> ({a3Pixels ? `${fmtNum(a3Pixels * (region!.meta.pixel_m / 1000) ** 2, 0)} km² ici` : "aucune dans cette région"})</span>
            </label>
          )}
          <label className="slider" title="Une zone regroupe les points dont le score est à moins de N points du meilleur">
            <span>Tolérance zones</span>
            <input type="range" min={1} max={20} step={1} value={tolerance} onChange={(e) => setTolerance(+e.target.value)} />
            <b>{tolerance} pts</b></label>
          {scored && <p className="hint">{fmtNum(scored.feasibleCount)} points respectent les contraintes
            ({fmtPct((100 * scored.feasibleCount) / (metrics!.width * metrics!.height))} de la région).</p>}
        </div>
      </div>

      {pickedInfo && region && (
        <div className="picked">
          <b>Point {fmtLatLon(pickedInfo.lat, pickedInfo.lon)}</b> · altitude {fmtNum(region.elev[pickedInfo.p])} m ·
          pente {fmtDeg(region.slopeMean[pickedInfo.p] / 10)} ·
          {region.psr[pickedInfo.p] ? " ombre permanente" : region.psrDistKm.length ? ` ombre permanente à ${fmtNum(region.psrDistKm[pickedInfo.p], 1)} km` : ""}
          {a3 && a3.mask[pickedInfo.p] ? ` · région Artemis III « ${a3.names[a3.mask[pickedInfo.p] - 1]} »` : ""}
          {metrics && <> · Soleil {fmtPct(metrics.sunPct[pickedInfo.p])} · nuit max {fmtDuration(metrics.nightH[pickedInfo.p])} ·
            Terre {fmtPct(metrics.earthPct[pickedInfo.p])} · score {scored && !Number.isNaN(scored.score[pickedInfo.p]) ? fmtNum(scored.score[pickedInfo.p], 1) : "hors contraintes"}</>}
          <button className="link" onClick={() => onAnalyze(pickedInfo.lat, pickedInfo.lon)}>Analyser ce point en détail</button>
        </div>
      )}

      {metrics && (
        zones.length ? (
          <div className="table-wrap">
            <table className="cmp">
              <thead><tr>
                <th>#</th><th>Meilleur point</th><th>Surface</th><th>Score</th><th>Soleil</th><th>Plus longue nuit</th>
                <th>Terre</th><th>Coupure max</th><th>Soleil + Terre</th><th>Pente</th><th title="Distance à la zone d'ombre permanente la plus proche">Ombre perm.</th><th title="Région candidate officielle (NASA 2022) contenant le meilleur point">Région Artemis III</th><th />
              </tr></thead>
              <tbody>
                {zones.map((z) => (
                  <tr key={z.rank}>
                    <td>{z.rank}</td>
                    <td className="nowrap">{fmtLatLon(z.lat, z.lon)} · {fmtNum(z.elevation)} m</td>
                    <td className="num">{fmtNum(z.areaKm2, 2)} km²</td>
                    <td className="num best">{fmtNum(z.score, 1)}</td>
                    <td className="num">{fmtPct(z.sunPct)}</td>
                    <td className="num">{fmtDuration(z.nightH)}</td>
                    <td className="num">{fmtPct(z.earthPct)}</td>
                    <td className="num">{fmtDuration(z.outageH)}</td>
                    <td className="num">{fmtPct(z.bothPct)}</td>
                    <td className="num">{fmtDeg(z.slope)}</td>
                    <td className="num">{Number.isFinite(z.psrKm) ? `${fmtNum(z.psrKm, 1)} km` : "—"}</td>
                    <td className="nowrap">{z.artemis ?? <span className="muted">hors régions</span>}</td>
                    <td><button className="link" onClick={() => onAnalyze(z.lat, z.lon)}>Analyser</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="hint">Résultats de dépistage (72 directions, pas de {metrics.stepMin} min, calcul en {fmtNum(metrics.ms / 1000, 1)} s).
              « Analyser » relance un calcul fin (720 directions, relief 20 m) sur le point et permet de l'ajouter au comparatif.</p>
          </div>
        ) : <p className="muted">Aucun point ne respecte toutes les contraintes : assouplissez-les.</p>
      )}
    </div>
  );
}
