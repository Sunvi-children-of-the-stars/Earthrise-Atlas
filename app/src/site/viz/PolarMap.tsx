/**
 * Map of the lunar south pole on the LROC WAC photo (polar stereographic, same grid as LOLA).
 * Drag to pan, wheel or buttons to zoom, click a site to select it or elsewhere to pick a point.
 * An optional overlay draws on top (permanent shadows, heat maps...).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { latLonToXY, xyToLatLon } from "../../astro/horizon";
import type { ArtemisRegionSet } from "../../astro/regions";
import type { SiteRecord } from "../../data";
import { useI18n } from "../i18n";
import { LROC } from "./geometry";

export type ToCanvas = (x: number, y: number) => [number, number];
export type Overlay = (ctx: CanvasRenderingContext2D, toCanvas: ToCanvas, pxPerMeter: number) => void;

interface Props {
  sites: SiteRecord[];
  selectedId?: string | null;
  onSelectSite?: (id: string) => void;
  onPickPoint?: (lat: number, lon: number) => void;
  labelOf?: (s: SiteRecord) => string;
  artemis?: ArtemisRegionSet | null;
  overlay?: Overlay;
  /** Initial view: centre (stereographic m) and half-width (m). */
  initial?: { cx: number; cy: number; half: number };
  height?: number;
}

let lrocImage: Promise<HTMLImageElement> | null = null;
function loadLroc(): Promise<HTMLImageElement> {
  if (!lrocImage) {
    lrocImage = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = "data/lroc/south_pole_wac_400m.jpg";
    });
  }
  return lrocImage;
}

const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const DEFAULT_VIEW = { cx: 0, cy: 100_000, half: 270_000 };

export function PolarMap({ sites, selectedId, onSelectSite, onPickPoint, labelOf, artemis, overlay, initial = DEFAULT_VIEW, height }: Props) {
  const { t } = useI18n();
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [view, setView] = useState(initial);
  const [size, setSize] = useState({ w: 600, h: height ?? 600 });
  const drag = useRef<{ x: number; y: number; cx: number; cy: number; moved: boolean } | null>(null);

  useEffect(() => { loadLroc().then(setImg).catch(() => setImg(null)); }, []);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      setSize({ w, h: height ?? Math.min(w, 720) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [height]);

  const ppm = size.w / 2 / view.half; // canvas px per metre
  const toCanvas: ToCanvas = useCallback((x, y) => [(x - view.cx) * ppm + size.w / 2, (view.cy - y) * ppm + size.h / 2], [view, ppm, size]);
  const toXY = useCallback((px: number, py: number): [number, number] => [view.cx + (px - size.w / 2) / ppm, view.cy - (py - size.h / 2) / ppm], [view, ppm, size]);

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(size.w * dpr);
    c.height = Math.round(size.h * dpr);
    const ctx = c.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = css("--bg-2") || "black";
    ctx.fillRect(0, 0, size.w, size.h);
    if (img) {
      const halfH = size.h / 2 / ppm;
      const sx = (view.cx - view.half + LROC.half) / LROC.pixel, sy = (LROC.half - (view.cy + halfH)) / LROC.pixel;
      const sw = (2 * view.half) / LROC.pixel, sh = (2 * halfH) / LROC.pixel;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, size.w, size.h);
    }
    if (artemis) {
      ctx.strokeStyle = css("--ice-line");
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      for (const r of artemis.regions) {
        ctx.beginPath();
        r.xy.forEach(([x, y], i) => { const [px, py] = toCanvas(x, y); if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); });
        ctx.closePath();
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }
    overlay?.(ctx, toCanvas, ppm);
    const ice = css("--ice"), white = css("--text");
    ctx.font = "500 12px Poppins, sans-serif";
    for (const s of sites) {
      const [px, py] = toCanvas(...latLonToXY(s.lat, s.lon));
      if (px < -20 || py < -20 || px > size.w + 20 || py > size.h + 20) continue;
      const sel = s.id === selectedId;
      ctx.beginPath();
      ctx.arc(px, py, sel ? 7 : 5, 0, 2 * Math.PI);
      if (s.category === "candidat" || s.category === "custom") { ctx.fillStyle = ice; ctx.fill(); }
      else { ctx.lineWidth = 2; ctx.strokeStyle = white; ctx.stroke(); }
      if (sel) { ctx.beginPath(); ctx.arc(px, py, 13, 0, 2 * Math.PI); ctx.lineWidth = 1.5; ctx.strokeStyle = ice; ctx.stroke(); }
      if (labelOf && (sel || s.category === "candidat" || ppm > 0.0015)) {
        ctx.fillStyle = white;
        ctx.shadowColor = "black"; ctx.shadowBlur = 4;
        ctx.fillText(labelOf(s), px + 11, py + 4);
        ctx.shadowBlur = 0;
      }
    }
  }, [img, view, size, ppm, sites, selectedId, artemis, overlay, labelOf, toCanvas]);

  const zoom = (f: number, px = size.w / 2, py = size.h / 2) => {
    const [x, y] = toXY(px, py);
    setView((v) => {
      const half = Math.min(LROC.half, Math.max(4_000, v.half * f));
      const k = half / v.half;
      return { cx: x + (v.cx - x) * k, cy: y + (v.cy - y) * k, half };
    });
  };

  const local = (e: React.PointerEvent | React.WheelEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top] as const;
  };
  const onDown = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX, y: e.clientY, cx: view.cx, cy: view.cy, moved: false };
    (e.target as Element).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (Math.hypot(dx, dy) > 4) d.moved = true;
    if (d.moved) setView((v) => ({ ...v, cx: d.cx - dx / ppm, cy: d.cy + dy / ppm }));
  };
  const onUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.moved) return;
    const [px, py] = local(e);
    let best: SiteRecord | null = null, bd = 14;
    for (const s of sites) {
      const [sx, sy] = toCanvas(...latLonToXY(s.lat, s.lon));
      const dd = Math.hypot(sx - px, sy - py);
      if (dd < bd) { bd = dd; best = s; }
    }
    if (best && onSelectSite) onSelectSite(best.id);
    else if (onPickPoint) { const [lat, lon] = xyToLatLon(...toXY(px, py)); onPickPoint(lat, lon); }
  };

  return (
    <div className="polar-map" ref={wrap}>
      <canvas ref={canvas} style={{ width: size.w, height: size.h }} role="img" aria-label={t("map.aria")}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}
        onWheel={(e) => { const [px, py] = local(e); zoom(e.deltaY > 0 ? 1.25 : 0.8, px, py); }} />
      <div className="map-controls">
        <button className="btn btn-ghost btn-small" aria-label={t("map.zoomIn")} onClick={() => zoom(0.7)}>+</button>
        <button className="btn btn-ghost btn-small" aria-label={t("map.zoomOut")} onClick={() => zoom(1.4)}>−</button>
        <button className="btn btn-ghost btn-small" onClick={() => setView(initial)}>{t("map.reset")}</button>
      </div>
    </div>
  );
}
