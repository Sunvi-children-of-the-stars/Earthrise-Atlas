/**
 * The sky seen from a site: azimuth (x, south in the middle for southern sites) × elevation (y).
 * Real horizon in front, Sun path in pale gold, Earth path in ice green (dashed when hidden).
 */
import { useId, useMemo } from "react";
import type { Sample } from "../../astro/analysis";
import { horizonAt, type HorizonMask } from "../../astro/horizon";
import { useI18n } from "../i18n";
import { azToX, niceTicks } from "./geometry";

interface Props { samples: Sample[]; cursor: number; mask: HorizonMask; centerAz?: number; compact?: boolean }

export function SkyChart({ samples, cursor, mask, centerAz = 180, compact = false }: Props) {
  const { t, fmt } = useI18n();
  const uid = useId().replace(/:/g, "");
  const W = 1000, H = compact ? 300 : 380, PL = 40, PR = 12, PT = 16, PB = 30;
  const PW = W - PL - PR;

  const { lo, hi } = useMemo(() => {
    let h = Math.max(...mask.el), l = Math.min(...mask.el);
    for (const s of samples) { h = Math.max(h, s.sAlt, s.eAlt); l = Math.min(l, s.sAlt, s.eAlt); }
    const top = Math.min(90, Math.ceil(h + 2)), bottom = Math.max(-12, Math.floor(Math.min(l - 1, -2)));
    return { lo: bottom, hi: Math.max(top, bottom + 6) };
  }, [samples, mask]);

  const x = (az: number) => PL + azToX(az, PW, centerAz);
  const y = (el: number) => PT + ((hi - Math.max(lo, Math.min(hi, el))) / (hi - lo)) * (H - PT - PB);

  const terrain = useMemo(() => {
    const n = 360, pts: string[] = [];
    for (let i = 0; i <= n; i++) {
      const xx = PL + (i / n) * PW;
      const az = centerAz - 180 + (i / n) * 360;
      pts.push(`${xx.toFixed(1)},${y(horizonAt(mask, az)).toFixed(1)}`);
    }
    return { fill: `M${PL},${H - PB} L${pts.join(" L")} L${PL + PW},${H - PB} Z`, line: `M${pts.join(" L")}` };
  }, [mask, lo, hi, centerAz, H]); // eslint-disable-line react-hooks/exhaustive-deps

  const track = (az: (s: Sample) => number, el: (s: Sample) => number, vis: (s: Sample) => boolean) => {
    const segs: { d: string; vis: boolean }[] = [];
    let cur: { d: string; vis: boolean } | null = null, prevX = 0, prevY = 0;
    const stride = Math.max(1, Math.floor(samples.length / 1500));
    for (let i = 0; i < samples.length; i += stride) {
      const s = samples[i], v = vis(s), xx = x(az(s)), yy = y(el(s));
      const wrap = Math.abs(xx - prevX) > PW / 2;
      if (!cur || cur.vis !== v || wrap) {
        if (cur) segs.push(cur);
        // A visibility change continues from the previous point (no gap); a wrap at the edge starts afresh
        const from = cur && !wrap ? `M${prevX.toFixed(1)},${prevY.toFixed(1)} L` : "M";
        cur = { d: `${from}${xx.toFixed(1)},${yy.toFixed(1)}`, vis: v };
      } else cur.d += ` L${xx.toFixed(1)},${yy.toFixed(1)}`;
      prevX = xx; prevY = yy;
    }
    if (cur) segs.push(cur);
    return segs;
  };
  const sun = useMemo(() => track((s) => s.sAz, (s) => s.sAlt, (s) => s.sunFrac >= 0.5), [samples, lo, hi, centerAz]); // eslint-disable-line react-hooks/exhaustive-deps
  const earth = useMemo(() => track((s) => s.eAz, (s) => s.eAlt, (s) => s.earthFrac >= 0.5), [samples, lo, hi, centerAz]); // eslint-disable-line react-hooks/exhaustive-deps
  const now = samples[Math.min(Math.max(cursor, 0), samples.length - 1)];
  const dirs: [number, string][] = [[0, t("dir.N")], [90, t("dir.E")], [180, t("dir.S")], [270, t("dir.W")]];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="viz" role="img" aria-label={t("sky.aria")}>
      <defs>
        <linearGradient id={`sky${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--bg)" /><stop offset="1" stopColor="var(--bg-2)" />
        </linearGradient>
        <radialGradient id={`glow${uid}`}><stop offset="0" stopColor="var(--sun)" stopOpacity="0.55" /><stop offset="1" stopColor="var(--sun)" stopOpacity="0" /></radialGradient>
      </defs>
      <rect x={PL} y={PT} width={PW} height={H - PT - PB} fill={`url(#sky${uid})`} />
      {niceTicks(lo, hi).map((v) => (
        <g key={v}>
          <line x1={PL} x2={PL + PW} y1={y(v)} y2={y(v)} className={v === 0 ? "viz-grid zero" : "viz-grid"} />
          <text x={PL - 8} y={y(v) + 4} className="viz-axis" textAnchor="end">{v}°</text>
        </g>
      ))}
      {dirs.map(([az, label]) => (
        <text key={az} x={x(az)} y={H - 9} className="viz-axis strong" textAnchor="middle">{label}</text>
      ))}
      {earth.map((s, i) => <path key={`e${i}`} d={s.d} className={s.vis ? "trk trk-earth" : "trk trk-earth off"} />)}
      {sun.map((s, i) => <path key={`s${i}`} d={s.d} className={s.vis ? "trk trk-sun" : "trk trk-sun off"} />)}
      {now && (
        <g>
          <circle cx={x(now.sAz)} cy={y(now.sAlt)} r={22} fill={`url(#glow${uid})`} />
          <circle cx={x(now.sAz)} cy={y(now.sAlt)} r={6} className={now.sunFrac >= 0.5 ? "dot-sun" : "dot-sun off"} />
          <circle cx={x(now.eAz)} cy={y(now.eAlt)} r={10} className={now.earthFrac >= 0.5 ? "dot-earth" : "dot-earth off"} />
          {!compact && (
            <>
              <text x={x(now.sAz)} y={y(now.sAlt) - 14} className="viz-label sun" textAnchor="middle">{t("body.sun")} {fmt.num(now.sAlt, 1)}°</text>
              <text x={x(now.eAz)} y={y(now.eAlt) + 26} className="viz-label earth" textAnchor="middle">{t("body.earth")} {fmt.num(now.eAlt, 1)}°</text>
            </>
          )}
        </g>
      )}
      <path d={terrain.fill} className="viz-ground" />
      <path d={terrain.line} className="viz-ridge" />
    </svg>
  );
}
