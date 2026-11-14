/** The five Story chapters. Every figure in the texts comes from the engine (figures.ts) or precomputed data. */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { simulate } from "../../astro/analysis";
import type { HorizonMask } from "../../astro/horizon";
import { relayAnalysis, type RelayData } from "../../astro/relay";
import type { SiteRecord } from "../../data";
import { useData } from "../data/store";
import { useI18n } from "../i18n";
import { siteText } from "../i18n/sites";
import { navigate } from "../router";
import { PolarMap, type Overlay } from "../viz/PolarMap";
import { SkyChart } from "../viz/SkyChart";
import { TimelineChart } from "../viz/TimelineChart";
import { STORY_HOURS, STORY_START, type StoryFigures } from "./figures";

/** Reveals its content when scrolled into view (instantly when the visitor prefers reduced motion). */
function Chapter({ id, n, title, children }: { id: string; n: number; title: string; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") { setSeen(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect(); } }, { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <section id={id} ref={ref} className={seen ? "chapter in" : "chapter"} aria-labelledby={`${id}-title`}>
      <div className="container">
        <div className="chapter-num">{String(n).padStart(2, "0")}</div>
        <h2 id={`${id}-title`}>{title}</h2>
        {children}
      </div>
    </section>
  );
}

interface PsrLayer { meta: { width: number; height: number; x_min_m: number; y_max_m: number; pixel_m: number }; psr: Uint8Array }

function usePolePsr(): { layer: PsrLayer | null; areaKm2: number | null } {
  const [layer, setLayer] = useState<PsrLayer | null>(null);
  const [areaKm2, setArea] = useState<number | null>(null);
  useEffect(() => {
    fetch("data/sites/psr_proximity.json").then((r) => r.json()).then((j) => setArea(j.regions?.pole?.psr_area_km2 ?? null)).catch(() => {});
    fetch("data/horizon_maps/pole.json").then((r) => r.json()).then(async (meta) => {
      if (!meta.files?.psr) return;
      const psr = new Uint8Array(await (await fetch(`data/horizon_maps/${meta.files.psr}`)).arrayBuffer());
      setLayer({ meta, psr });
    }).catch(() => { /* optional layer */ });
  }, []);
  return { layer, areaKm2 };
}

function psrOverlay(layer: PsrLayer | null): Overlay | undefined {
  if (!layer) return undefined;
  const { meta, psr } = layer;
  const off = document.createElement("canvas");
  off.width = meta.width; off.height = meta.height;
  const g = off.getContext("2d")!;
  const img = g.createImageData(meta.width, meta.height);
  const ice = getComputedStyle(document.documentElement).getPropertyValue("--ice").trim() || "white";
  g.fillStyle = ice; g.fillRect(0, 0, 1, 1);
  const [r, gg, b] = g.getImageData(0, 0, 1, 1).data;
  for (let p = 0; p < psr.length; p++) {
    if (!psr[p]) continue;
    img.data.set([r, gg, b, 150], p * 4);
  }
  g.putImageData(img, 0, 0);
  return (ctx, toCanvas) => {
    const [x0, y0] = toCanvas(meta.x_min_m, meta.y_max_m);
    const [x1, y1] = toCanvas(meta.x_min_m + meta.width * meta.pixel_m, meta.y_max_m - meta.height * meta.pixel_m);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(off, x0, y0, x1 - x0, y1 - y0);
    ctx.imageSmoothingEnabled = true;
  };
}

interface Transect { points: { distKm: number; sunPct: number; earthPct: number; nightH: number; outageH: number }[] }

export function Chapters({ ridge, ridgeMask, lro, figs }: { ridge: SiteRecord | null; ridgeMask: HorizonMask | null; lro: RelayData | null; figs: StoryFigures | null }) {
  const { t, fmt, lang } = useI18n();
  const { sites } = useData();
  const { layer, areaKm2 } = usePolePsr();
  const overlay = useMemo(() => psrOverlay(layer), [layer]);
  const samples = useMemo(() => (ridge && ridgeMask && figs ? simulate(ridge, ridgeMask, STORY_START, STORY_HOURS, 30) : []), [ridge, ridgeMask, figs]);
  const relayWin = useMemo(() => (ridge && ridgeMask && lro && figs ? relayAnalysis(ridge, ridgeMask, lro, STORY_START, STORY_HOURS) : null), [ridge, ridgeMask, lro, figs]);
  const [cursor, setCursor] = useState(0);
  const [tr, setTr] = useState<Transect | null>(null);
  const [km, setKm] = useState(0);
  useEffect(() => { fetch("data/story/mons-mouton-transect.json").then((r) => r.json()).then(setTr).catch(() => {}); }, []);
  const point = tr?.points.reduce((a, p) => (Math.abs(p.distKm - km) < Math.abs(a.distKm - km) ? p : a), tr.points[0]);
  const site0 = tr?.points.find((p) => p.distKm === 0);
  const polar = sites.filter((s) => s.category === "candidat");
  const mouton = sites.find((s) => s.id === "mons-mouton");

  return (
    <>
      <Chapter id="chapter-1" n={1} title={t("ch1.title")}>
        <p className="chapter-lead">{t("ch1.text")}</p>
        <p className="chapter-lead">{areaKm2 !== null ? t("ch1.area", { area: fmt.num(areaKm2, 0) }) : ""}</p>
        <figure className="chapter-figure">
          <PolarMap sites={polar} labelOf={(s) => siteText(s, lang).short} overlay={overlay} initial={{ cx: 0, cy: 0, half: 42_000 }} height={460} />
          <figcaption>{t("ch1.caption")}</figcaption>
        </figure>
      </Chapter>

      <Chapter id="chapter-2" n={2} title={t("ch2.title")}>
        <p className="chapter-lead">{figs ? t("ch2.text", { max: fmt.num(figs.sunMaxAlt, 1), pct: fmt.pct(figs.sunPct) }) : t("common.loading")}</p>
        {samples.length > 0 && ridgeMask && (
          <figure className="chapter-figure">
            <SkyChart samples={samples} cursor={cursor} mask={ridgeMask} compact />
            <input className="chapter-range" type="range" min={0} max={samples.length - 1} value={cursor} aria-label={t("tl.cursor")} onChange={(e) => setCursor(Number(e.target.value))} />
            <figcaption>{t("ch2.caption", { date: fmt.date(STORY_START) })}</figcaption>
          </figure>
        )}
      </Chapter>

      <Chapter id="chapter-3" n={3} title={t("ch3.title")}>
        <p className="chapter-lead">{figs ? t("ch3.text", { pct: fmt.pct(figs.earthPct), h: fmt.hours(figs.longestNoEarthH) }) : t("common.loading")}</p>
        {samples.length > 0 && (
          <figure className="chapter-figure">
            <h4 className="figure-title">{t("ch3.without")}</h4>
            <TimelineChart samples={samples} cursor={-1} showElevation={false} />
            {relayWin && relayWin.available && (
              <>
                <h4 className="figure-title">{t("ch3.with")}</h4>
                <TimelineChart samples={samples} cursor={-1} showElevation={false} relayWindows={relayWin.windows} />
              </>
            )}
            {figs && figs.longestNoLinkH !== null && figs.passesPerDay !== null && (
              <figcaption>{t("ch3.relay", { h: fmt.hours(figs.longestNoLinkH), n: fmt.num(figs.passesPerDay, 0) })}</figcaption>
            )}
          </figure>
        )}
      </Chapter>

      <Chapter id="chapter-4" n={4} title={t("ch4.title")}>
        <p className="chapter-lead">{t("ch4.text", { site: mouton ? siteText(mouton, lang).short : "Mons Mouton" })}</p>
        {tr && point && site0 && (
          <figure className="chapter-figure km">
            <div className="km-values">
              <div><div className="stat-label">{t("ch4.distance")}</div><div className="km-big">{km === 0 ? t("ch4.atSite") : t(km > 0 ? "ch4.east" : "ch4.west", { m: fmt.num(Math.abs(km) * 1000, 0) })}</div></div>
              <div><div className="stat-label">{t("body.earth")}</div><div className="km-big earth">{fmt.pct(point.earthPct)}</div></div>
              <div><div className="stat-label">{t("body.sun")}</div><div className="km-big sun">{fmt.pct(point.sunPct)}</div></div>
            </div>
            <TransectLine points={tr.points} km={km} />
            <input className="chapter-range" type="range" min={-2} max={2} step={0.1} value={km} aria-label={t("ch4.distance")}
              onChange={(e) => setKm(Math.round(Number(e.target.value) * 10) / 10)} />
            <figcaption>{t("ch4.caption", { pct: fmt.pct(site0.earthPct) })}</figcaption>
          </figure>
        )}
      </Chapter>

      <Chapter id="chapter-5" n={5} title={t("ch5.title")}>
        <p className="chapter-lead">{t("ch5.text")}</p>
        <div className="row center-row">
          <a className="btn btn-primary" href="/play" onClick={(e) => { e.preventDefault(); navigate("play"); }}>{t("ch5.play")}</a>
          <a className="btn btn-ghost" href="/atlas" onClick={(e) => { e.preventDefault(); navigate("atlas"); }}>{t("ch5.atlas")}</a>
        </div>
      </Chapter>
    </>
  );
}

/** Earth visibility along the transect (ice green), with the slider position. */
function TransectLine({ points, km }: { points: Transect["points"]; km: number }) {
  const { t } = useI18n();
  const W = 1000, H = 160, P = 24;
  const x = (d: number) => P + ((d + 2) / 4) * (W - 2 * P);
  const y = (v: number) => P + ((100 - v) / 100) * (H - 2 * P);
  const line = (f: (p: Transect["points"][0]) => number) => points.map((p, i) => `${i ? "L" : "M"}${x(p.distKm).toFixed(1)},${y(f(p)).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="viz" role="img" aria-label={t("ch4.chart")}>
      <line x1={P} x2={W - P} y1={y(100)} y2={y(100)} className="viz-grid" />
      <line x1={P} x2={W - P} y1={y(0)} y2={y(0)} className="viz-grid zero" />
      <path d={line((p) => p.sunPct)} className="elev-line sun" />
      <path d={line((p) => p.earthPct)} className="elev-line earth" />
      <line x1={x(0)} x2={x(0)} y1={P - 8} y2={H - P + 8} className="viz-grid zero" />
      <line x1={x(km)} x2={x(km)} y1={P - 8} y2={H - P + 8} className="viz-cursor" />
      <text x={P} y={H - 4} className="viz-axis">-2 km</text>
      <text x={W - P} y={H - 4} className="viz-axis" textAnchor="end">+2 km</text>
    </svg>
  );
}
