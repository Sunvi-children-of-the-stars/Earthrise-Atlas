import { useRef, type PointerEvent } from "react";
import type { Fragility, Metrics, Sample, Window } from "../astro/analysis";
import type { RelayResult } from "../astro/relay";
import { fmtDate } from "../format";

const W = 1000, H = 336, PL = 44, PR = 12, PT = 12;
const BAND_H = 12, BANDS_Y = 214;

interface Props {
  samples: Sample[];
  m: Metrics;
  fragile: Fragility;
  relay?: RelayResult | null;
  cursor: number;
  onCursor: (i: number) => void;
}

/** Elevation of the Sun and the Earth over time, with visibility bands. */
export function Timeline({ samples, m, fragile, relay, cursor, onCursor }: Props) {
  const ref = useRef<SVGSVGElement>(null);
  const t0 = samples[0].t, t1 = samples[samples.length - 1].t;
  const plotB = BANDS_Y - 16;
  let lo = 0, hi = 0;
  for (const s of samples) {
    lo = Math.min(lo, s.sAlt, s.eAlt);
    hi = Math.max(hi, s.sAlt, s.eAlt);
  }
  lo = Math.max(-20, Math.floor(lo - 1));
  hi = Math.min(90, Math.ceil(hi + 1));
  const x = (t: number) => PL + ((t - t0) / (t1 - t0)) * (W - PL - PR);
  const y = (v: number) => PT + ((hi - Math.max(lo, Math.min(hi, v))) / (hi - lo)) * (plotB - PT);

  const stride = Math.max(1, Math.floor(samples.length / 1200));
  const line = (f: (s: Sample) => number) => {
    let d = "";
    for (let i = 0; i < samples.length; i += stride) {
      d += `${i ? " L" : "M"}${x(samples[i].t).toFixed(1)},${y(f(samples[i])).toFixed(1)}`;
    }
    return d;
  };

  const band = (ws: Window[], row: number, cls: string) =>
    ws.map((w, i) => (
      <rect key={i} x={x(w.start)} width={Math.max(1, x(w.end) - x(w.start))}
        y={BANDS_Y + row * (BAND_H + 6)} height={BAND_H} className={cls} />
    ));

  const nTicks = 6;
  const ticks = Array.from({ length: nTicks + 1 }, (_, i) => t0 + ((t1 - t0) * i) / nTicks);
  const step = (hi - lo) > 40 ? 15 : (hi - lo) > 15 ? 5 : 2;
  const yTicks: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) yTicks.push(v);

  const pick = (e: PointerEvent) => {
    if (!ref.current || (e.type === "pointermove" && e.buttons !== 1)) return;
    const r = ref.current.getBoundingClientRect();
    const fx = ((e.clientX - r.left) / r.width) * W;
    const f = Math.min(1, Math.max(0, (fx - PL) / (W - PL - PR)));
    onCursor(Math.round(f * (samples.length - 1)));
  };

  const cur = samples[cursor];
  return (
    <svg ref={ref} viewBox={`0 0 ${W} ${H}`} className="chart timeline" onPointerDown={pick}
      onPointerMove={pick} role="img" aria-label="Chronologie des élévations du Soleil et de la Terre">
      {yTicks.map((v) => (
        <g key={v}>
          <line x1={PL} x2={W - PR} y1={y(v)} y2={y(v)} className={v === 0 ? "grid zero" : "grid"} />
          <text x={PL - 6} y={y(v) + 4} className="axis" textAnchor="end">{v}°</text>
        </g>
      ))}
      <path d={line((s) => s.eHz)} className="hzline earth" />
      <path d={line((s) => s.sHz)} className="hzline sun" />
      <path d={line((s) => s.eAlt)} className="elev earth" />
      <path d={line((s) => s.sAlt)} className="elev sun" />

      <text x={PL - 6} y={BANDS_Y + 10} className="axis" textAnchor="end">☀</text>
      <text x={PL - 6} y={BANDS_Y + BAND_H + 6 + 10} className="axis" textAnchor="end">⊕</text>
      <text x={PL - 6} y={BANDS_Y + 2 * (BAND_H + 6) + 10} className="axis" textAnchor="end">☀⊕</text>
      <text x={PL - 6} y={BANDS_Y + 3 * (BAND_H + 6) + 10} className="axis" textAnchor="end">⚠</text>
      <text x={PL - 6} y={BANDS_Y + 4 * (BAND_H + 6) + 10} className="axis" textAnchor="end">LRO</text>
      <rect x={PL} y={BANDS_Y} width={W - PL - PR} height={5 * BAND_H + 24} className="band-bg" />
      {band(m.sunWindows, 0, "band sun")}
      {band(m.earthWindows, 1, "band earth")}
      {band(m.bothWindows, 2, "band both")}
      {band(fragile.windows, 3, "band frag")}
      {relay && band(relay.windows.map((w) => ({ ...w, openStart: false, openEnd: false })), 4, "band relay")}

      {ticks.map((t, i) => (
        <text key={i} x={x(t)} y={H - 8} className="axis"
          textAnchor={i === 0 ? "start" : i === nTicks ? "end" : "middle"}>
          {fmtDate(t, (t1 - t0) < 8 * 86_400_000).replace(" UTC", "")}
        </text>
      ))}
      {cur && <line x1={x(cur.t)} x2={x(cur.t)} y1={PT} y2={BANDS_Y + 5 * BAND_H + 24} className="cursor" />}
    </svg>
  );
}
