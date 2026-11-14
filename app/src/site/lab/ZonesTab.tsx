/** Zones: best landing zones of a region for a mission profile, on the LROC photo of the region. */
import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { latLonToXY } from "../../astro/horizon";
import { rasterizeRegions } from "../../astro/regions";
import { mapsBaseUrl, runRegion } from "../../optim/client";
import type { RegionMetrics } from "../../optim/evaluate";
import { loadRegion, loadRegionIndex, pixelLatLon, type RegionData, type RegionIndexEntry } from "../../optim/region";
import { roverRoute, targets, type Route } from "../../optim/rover";
import { CRITERIA, extractZones, NO_PSR_LIMIT, PROFILES, scoreRegion, type Constraints, type Criterion } from "../../optim/score";
import { useData } from "../data/store";
import { relayLabel, useI18n, type MessageKey } from "../i18n";

type Layer = "score" | "sun" | "earth" | "slope";
const LAYERS: { id: Layer; key: MessageKey }[] = [
  { id: "score", key: "lab.layer.score" }, { id: "sun", key: "lab.layer.sun" }, { id: "earth", key: "lab.layer.earth" }, { id: "slope", key: "lab.layer.slope" },
];
const cssVar = (n: string) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const rgbOf = (color: string): [number, number, number] => {
  const c = document.createElement("canvas").getContext("2d")!;
  c.fillStyle = color; c.fillRect(0, 0, 1, 1);
  const d = c.getImageData(0, 0, 1, 1).data;
  return [d[0], d[1], d[2]];
};

export function ZonesTab({ start, hours, onOpen }: { start: number; hours: number; onOpen: (lat: number, lon: number) => void }) {
  const { t, fmt } = useI18n();
  const { artemis, relays, sites } = useData();
  const [index, setIndex] = useState<RegionIndexEntry[] | null>(null);
  const [regionId, setRegionId] = useState("");
  const [region, setRegion] = useState<RegionData | null>(null);
  const [wac, setWac] = useState<Uint8Array | null>(null);
  const [metrics, setMetrics] = useState<RegionMetrics | null>(null);
  const [ranFor, setRanFor] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [profileId, setProfileId] = useState(PROFILES[0].id);
  const [weights, setWeights] = useState<Record<Criterion, number>>(PROFILES[0].weights);
  const [cons, setCons] = useState<Constraints>(PROFILES[0].constraints);
  const [tolerance, setTolerance] = useState(3);
  const [layer, setLayer] = useState<Layer>("score");
  const [relayId, setRelayId] = useState("lro");
  const [picked, setPicked] = useState<number | null>(null);
  const [route, setRoute] = useState<Route | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    loadRegionIndex(mapsBaseUrl()).then((ix) => { setIndex(ix); setRegionId(ix[0]?.id ?? ""); }).catch(() => setError(t("lab.zones.noMaps")));
  }, [t]);
  const entry = index?.find((r) => r.id === regionId);
  useEffect(() => {
    if (!entry) return;
    setRegion(null); setMetrics(null); setPicked(null); setRoute(null); setWac(null);
    loadRegion(mapsBaseUrl(), entry.file, false).then(async (r) => {
      setRegion(r);
      const f = (r.meta.files as { wac?: string }).wac;
      if (f) { const b = await fetch(`${mapsBaseUrl()}${f}`); if (b.ok) setWac(new Uint8Array(await b.arrayBuffer())); }
    }).catch((e) => setError(String(e)));
  }, [entry]);

  const relay = relayId === "none" ? null : relays.find((r) => r.meta.id.startsWith(relayId)) ?? null;
  const run = () => {
    if (!entry) return;
    setError(null); setProgress(0); setRoute(null);
    runRegion(entry.file, start, hours, (_p, f) => setProgress(f), relay)
      .then((m) => { setMetrics(m); setRanFor(`${entry.id}@${start}@${hours}@${relayId}`); setProgress(null); })
      .catch((e) => { setError(String(e)); setProgress(null); });
  };
  const stale = metrics && ranFor !== `${entry?.id}@${start}@${hours}@${relayId}`;

  const a3 = useMemo(() => (region && artemis ? { mask: rasterizeRegions(artemis, region.meta), names: artemis.regions.map((r) => r.name) } : null), [region, artemis]);
  const scored = useMemo(() => (region && metrics ? scoreRegion(region, metrics, weights, cons, a3?.mask) : null), [region, metrics, weights, cons, a3]);
  const zones = useMemo(() => (region && metrics && scored?.feasibleCount ? extractZones(region, metrics, scored, tolerance, 6, a3 ?? undefined) : []),
    [region, metrics, scored, tolerance, a3]);

  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx || !region) return;
    const { width: W, height: H } = region.meta;
    const ice = rgbOf(cssVar("--ice")), sun = rgbOf(cssVar("--sun"));
    const img = ctx.createImageData(W, H);
    for (let p = 0; p < W * H; p++) {
      const g = wac ? wac[p] : 90;
      let rgb: [number, number, number] = [g, g, g];
      let v = NaN, col = ice;
      if (layer === "slope") { v = Math.min(1, region.slopeMean[p] / 10 / 20); col = [255, 255, 255]; }
      else if (metrics && scored) {
        if (!scored.feasible[p]) rgb = [g * 0.35, g * 0.35, g * 0.35];
        else if (layer === "score") v = scored.score[p] / 100;
        else if (layer === "sun") { v = metrics.sunPct[p] / 100; col = sun; }
        else if (layer === "earth") v = metrics.earthPct[p] / 100;
      }
      if (!Number.isNaN(v)) { const a = 0.15 + 0.7 * v; rgb = [g * (1 - a) + col[0] * a, g * (1 - a) + col[1] * a, g * (1 - a) + col[2] * a]; }
      if (region.psr[p]) rgb = [0, 0, 0];
      img.data.set([rgb[0], rgb[1], rgb[2], 255], p * 4);
    }
    ctx.putImageData(img, 0, 0);
    const m = region.meta;
    const px = (x: number, y: number) => [(x - m.x_min_m) / m.pixel_m, (m.y_max_m - y) / m.pixel_m] as const;
    if (artemis) {
      ctx.save(); ctx.strokeStyle = cssVar("--ice-line"); ctx.setLineDash([4, 3]); ctx.lineWidth = 1;
      for (const r of artemis.regions) { ctx.beginPath(); r.xy.forEach(([x, y], i) => { const [a, b] = px(x, y); if (i) ctx.lineTo(a, b); else ctx.moveTo(a, b); }); ctx.closePath(); ctx.stroke(); }
      ctx.restore();
    }
    ctx.font = "500 10px Poppins, sans-serif";
    for (const s of sites) {
      const [a, b] = px(...latLonToXY(s.lat, s.lon));
      if (a < 0 || b < 0 || a >= W || b >= H) continue;
      ctx.strokeStyle = "white"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(a, b, 4, 0, 2 * Math.PI); ctx.stroke();
    }
    if (route?.found) {
      ctx.strokeStyle = cssVar("--ice"); ctx.lineWidth = 2; ctx.beginPath();
      route.points.forEach((q, i) => { const [a, b] = px(...latLonToXY(q.lat, q.lon)); if (i) ctx.lineTo(a, b); else ctx.moveTo(a, b); });
      ctx.stroke();
    }
    for (const z of zones) {
      ctx.beginPath(); ctx.arc(z.bestCol + 0.5, z.bestRow + 0.5, 7, 0, 2 * Math.PI); ctx.fillStyle = "white"; ctx.fill();
      ctx.fillStyle = "black"; ctx.textAlign = "center"; ctx.fillText(String(z.rank), z.bestCol + 0.5, z.bestRow + 4); ctx.textAlign = "start";
    }
    if (picked !== null) { ctx.strokeStyle = cssVar("--ice"); ctx.lineWidth = 2; ctx.strokeRect((picked % W) - 4, Math.floor(picked / W) - 4, 9, 9); }
  }, [region, wac, metrics, scored, layer, zones, picked, route, artemis, sites]);

  const click = (e: MouseEvent<HTMLCanvasElement>) => {
    if (!region) return;
    const r = e.currentTarget.getBoundingClientRect();
    const c = Math.floor(((e.clientX - r.left) / r.width) * region.meta.width), rr = Math.floor(((e.clientY - r.top) / r.height) * region.meta.height);
    setPicked(rr * region.meta.width + c); setRoute(null);
  };
  const applyProfile = (id: string) => { const p = PROFILES.find((x) => x.id === id)!; setProfileId(id); setWeights(p.weights); setCons(p.constraints); };
  const profileKey = (id: string) => `profile.${id}` as MessageKey;
  const pickedLL = region && picked !== null ? pixelLatLon(region.meta, picked % region.meta.width, Math.floor(picked / region.meta.width)) : null;
  const goRover = (kind: "night" | "ice") => {
    if (!region || !pickedLL) return;
    const target = kind === "ice" ? targets.nearIce(region, 0.3) : metrics ? targets.shortNight(metrics, Math.max(1, metrics.nightH[picked!] / 2)) : null;
    if (target) setRoute(roverRoute(region, pickedLL[0], pickedLL[1], target, { maxSlope: 15 }));
  };

  if (error && !index) return <p className="muted">{error}</p>;
  return (
    <div className="zones">
      <div className="row lab-row">
        <label className="field">{t("lab.zones.region")}
          <select value={regionId} onChange={(e) => setRegionId(e.target.value)}>{index?.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
        </label>
        <label className="field">{t("lab.zones.profile")}
          <select value={profileId} onChange={(e) => applyProfile(e.target.value)}>{PROFILES.map((p) => <option key={p.id} value={p.id}>{t(profileKey(p.id))}</option>)}</select>
        </label>
        <label className="field">{t("lab.zones.layer")}
          <select value={layer} onChange={(e) => setLayer(e.target.value as Layer)}>{LAYERS.map((l) => <option key={l.id} value={l.id}>{t(l.key)}</option>)}</select>
        </label>
        <button className="btn btn-primary" disabled={progress !== null || !region} onClick={run}>
          {progress !== null ? t("lab.zones.running", { pct: Math.round(progress * 100) }) : metrics ? t("lab.zones.rerun") : t("lab.zones.run")}
        </button>
      </div>
      <p className="small muted">{t(`profile.${profileId}.desc` as MessageKey)}</p>
      {stale && <p className="small">{t("lab.zones.stale")}</p>}
      {error && <p className="small">{error}</p>}
      <div className="zones-grid">
        <div>
          {region ? <canvas ref={canvas} width={region.meta.width} height={region.meta.height} className="zones-canvas" onClick={click} role="img" aria-label={t("lab.zones.aria")} />
            : <p className="muted">{t("common.loading")}</p>}
          <p className="small faint">{t("lab.zones.legend")}</p>
        </div>
        <div className="stack">
          {metrics && scored && <p className="small muted">{t("lab.zones.feasible", { n: fmt.num(scored.feasibleCount, 0), s: fmt.num(metrics.ms / 1000, 1) })}</p>}
          {zones.length > 0 && (
            <table className="table">
              <thead><tr><th>#</th><th>{t("lab.col.score")}</th><th>{t("body.sun")}</th><th>{t("body.earth")}</th><th>{t("play.delay.night")}</th><th>{t("lab.col.slope")}</th><th></th></tr></thead>
              <tbody>{zones.map((z) => (
                <tr key={z.rank}><td>{z.rank}</td><td>{fmt.num(z.score, 0)}</td><td>{fmt.pct(z.sunPct)}</td><td>{fmt.pct(z.earthPct)}</td><td>{fmt.hours(z.nightH)}</td><td>{fmt.num(z.slope, 1)}°</td>
                  <td><button className="btn btn-ghost btn-small" onClick={() => onOpen(z.lat, z.lon)}>{t("lab.open")}</button></td></tr>
              ))}</tbody>
            </table>
          )}
          {metrics && scored && zones.length === 0 && <p className="muted">{t("lab.zones.none")}</p>}
          {pickedLL && metrics && (
            <div className="panel small">
              <strong>{fmt.num(Math.abs(pickedLL[0]), 3)}°S, {fmt.num(Math.abs(pickedLL[1]), 3)}°{pickedLL[1] < 0 ? "W" : "E"}</strong>
              <div className="muted">{t("body.sun")} {fmt.pct(metrics.sunPct[picked!])} · {t("body.earth")} {fmt.pct(metrics.earthPct[picked!])} · {t("play.delay.night")} {fmt.hours(metrics.nightH[picked!])}</div>
              <div className="row" style={{ marginTop: 10 }}>
                <button className="btn btn-ghost btn-small" onClick={() => onOpen(pickedLL[0], pickedLL[1])}>{t("lab.open")}</button>
                <button className="btn btn-ghost btn-small" onClick={() => goRover("night")}>{t("lab.rover.night")}</button>
                <button className="btn btn-ghost btn-small" onClick={() => goRover("ice")}>{t("lab.rover.ice")}</button>
              </div>
              {route && <p className="muted" style={{ marginTop: 8 }}>{route.found
                ? t("lab.rover.result", { km: fmt.num(route.lengthKm, 2), slope: fmt.num(route.maxSlope, 1), h: fmt.hours(route.driveH) })
                : t("lab.rover.none")}</p>}
            </div>
          )}
        </div>
      </div>
      <details className="advanced">
        <summary>{t("lab.advanced")}</summary>
        <div className="adv-grid">
          {CRITERIA.map((c) => (
            <label key={c.id} className="field" title={c.hint}>{t(`crit.${c.id}` as MessageKey)} ({weights[c.id]})
              <input type="range" min={0} max={5} value={weights[c.id]} onChange={(e) => { setWeights({ ...weights, [c.id]: Number(e.target.value) }); setProfileId("custom"); }} />
            </label>
          ))}
          <label className="field">{t("lab.cons.slope", { v: cons.slopeMax })}
            <input type="range" min={2} max={30} value={cons.slopeMax} onChange={(e) => setCons({ ...cons, slopeMax: Number(e.target.value) })} /></label>
          <label className="field">{t("lab.cons.sun", { v: cons.sunMinPct })}
            <input type="range" min={0} max={100} step={5} value={cons.sunMinPct} onChange={(e) => setCons({ ...cons, sunMinPct: Number(e.target.value) })} /></label>
          <label className="field">{t("lab.cons.earth", { v: cons.earthMinPct })}
            <input type="range" min={0} max={100} step={5} value={cons.earthMinPct} onChange={(e) => setCons({ ...cons, earthMinPct: Number(e.target.value) })} /></label>
          <label className="field">{t("lab.cons.psr", { v: cons.psrMaxKm >= NO_PSR_LIMIT ? "-" : cons.psrMaxKm })}
            <input type="range" min={1} max={NO_PSR_LIMIT} value={cons.psrMaxKm} onChange={(e) => setCons({ ...cons, psrMaxKm: Number(e.target.value) })} /></label>
          <label className="field">{t("lab.cons.tolerance", { v: tolerance })}
            <input type="range" min={0} max={20} value={tolerance} onChange={(e) => setTolerance(Number(e.target.value))} /></label>
          <label className="field">{t("lab.relay")}
            <select value={relayId} onChange={(e) => setRelayId(e.target.value)}>
              <option value="none">{t("lab.relay.none")}</option>
              {relays.map((r) => { const id = r.meta.id.split("_")[0]; return <option key={id} value={id}>{relayLabel(r.meta.id, t, r.meta.satellite)}{r.meta.kind === "model" ? ` (${t("lab.model")})` : ""}</option>; })}
            </select></label>
          <label className="field row-check"><input type="checkbox" checked={!!cons.onlyArtemis} onChange={(e) => setCons({ ...cons, onlyArtemis: e.target.checked })} /> {t("lab.cons.artemis")}</label>
        </div>
      </details>
    </div>
  );
}
