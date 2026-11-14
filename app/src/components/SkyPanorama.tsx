import { useMemo } from "react";
import type { Sample } from "../astro/analysis";
import type { HorizonMask } from "../astro/horizon";
import { fmtDeg } from "../format";

const W = 1000, H = 340, PL = 44, PR = 12, PT = 14, PB = 30;

interface Props { samples: Sample[]; cursor: number; mask: HorizonMask }

/** Panorama: azimuth (x) × elevation (y), terrain horizon, Sun and Earth tracks. */
export function SkyPanorama({ samples, cursor, mask }: Props) {
  const { yMin, yMax } = useMemo(() => {
    let hi = Math.max(...mask.el);
    let lo = Math.min(...mask.el);
    for (const s of samples) {
      hi = Math.max(hi, s.sAlt, s.eAlt);
      lo = Math.min(lo, s.sAlt, s.eAlt);
    }
    const top = Math.min(90, Math.ceil(hi + 2));
    const bottom = Math.max(-12, Math.floor(Math.min(lo - 1, -2)));
    return { yMin: bottom, yMax: Math.max(top, bottom + 6) };
  }, [samples, mask]);

  const x = (az: number) => PL + (az / 360) * (W - PL - PR);
  const y = (el: number) => PT + ((yMax - el) / (yMax - yMin)) * (H - PT - PB);
  // Radii: Earth (1.9°) ≈ 3.6 × Sun (0.53°), kept readable
  const rSun = 5, rEarth = 9;

  const terrain = useMemo(() => {
    const pts = mask.az.map((a, i) => `${x(a)},${y(Math.max(yMin, mask.el[i]))}`);
    pts.push(`${x(360)},${y(Math.max(yMin, mask.el[0]))}`);
    return `M${x(0)},${y(yMin)} L${pts.join(" L")} L${x(360)},${y(yMin)} Z`;
  }, [mask, yMin, yMax]); // x and y depend only on yMin / yMax

  const track = (az: (s: Sample) => number, el: (s: Sample) => number, vis: (s: Sample) => boolean) => {
    const segs: { d: string; vis: boolean }[] = [];
    let cur: { d: string; vis: boolean } | null = null;
    let prevAz = 0;
    const stride = Math.max(1, Math.floor(samples.length / 1500));
    for (let i = 0; i < samples.length; i += stride) {
      const s = samples[i];
      const v = vis(s);
      const jump = cur && Math.abs(az(s) - prevAz) > 180;
      if (!cur || cur.vis !== v || jump) {
        if (cur) segs.push(cur);
        cur = { d: `M${x(az(s))},${y(el(s))}`, vis: v };
      } else cur.d += ` L${x(az(s))},${y(el(s))}`;
      prevAz = az(s);
    }
    if (cur) segs.push(cur);
    return segs;
  };

  const sunSegs = track((s) => s.sAz, (s) => s.sAlt, (s) => s.sunFrac >= 0.5);
  const earthSegs = track((s) => s.eAz, (s) => s.eAlt, (s) => s.earthFrac >= 0.5);
  const now = samples[Math.min(cursor, samples.length - 1)];

  const yTicks: number[] = [];
  const stepY = yMax - yMin > 40 ? 15 : yMax - yMin > 15 ? 5 : 2;
  for (let v = Math.ceil(yMin / stepY) * stepY; v <= yMax; v += stepY) yTicks.push(v);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img"
      aria-label="Panorama du ciel : horizon, trajectoires du Soleil et de la Terre">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#05070d" />
          <stop offset="1" stopColor="#0d1424" />
        </linearGradient>
        <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6c707a" />
          <stop offset="1" stopColor="#2b2e35" />
        </linearGradient>
      </defs>
      <rect x={PL} y={PT} width={W - PL - PR} height={H - PT - PB} fill="url(#sky)" />
      {yTicks.map((v) => (
        <g key={v}>
          <line x1={PL} x2={W - PR} y1={y(v)} y2={y(v)} className={v === 0 ? "grid zero" : "grid"} />
          <text x={PL - 6} y={y(v) + 4} className="axis" textAnchor="end">{v}°</text>
        </g>
      ))}
      {[0, 45, 90, 135, 180, 225, 270, 315, 360].map((a) => (
        <g key={a}>
          <line x1={x(a)} x2={x(a)} y1={PT} y2={H - PB} className="grid" />
          <text x={x(a)} y={H - 10} className="axis" textAnchor="middle">
            {({ 0: "N", 90: "E", 180: "S", 270: "O", 360: "N" } as Record<number, string>)[a] ?? `${a}°`}
          </text>
        </g>
      ))}
      {earthSegs.map((s, i) => (
        <path key={`e${i}`} d={s.d} className={s.vis ? "trk earth" : "trk earth hidden"} />
      ))}
      {sunSegs.map((s, i) => (
        <path key={`s${i}`} d={s.d} className={s.vis ? "trk sun" : "trk sun hidden"} />
      ))}
      {now && (
        <>
          <circle cx={x(now.eAz)} cy={y(now.eAlt)} r={rEarth}
            className={now.earthFrac >= 0.5 ? "earth-dot" : "earth-dot off"} />
          <circle cx={x(now.sAz)} cy={y(now.sAlt)} r={rSun}
            className={now.sunFrac >= 0.5 ? "sun-dot" : "sun-dot off"} />
          <text x={x(now.sAz)} y={y(now.sAlt) - rSun - 6} className="lbl sun-txt"
            textAnchor="middle">Soleil {fmtDeg(now.sAlt)}</text>
          <text x={x(now.eAz)} y={y(now.eAlt) + rEarth + 14} className="lbl earth-txt"
            textAnchor="middle">Terre {fmtDeg(now.eAlt)}</text>
        </>
      )}
      {/* Terrain drawn last: it hides whatever is below the horizon */}
      <path d={terrain} fill="url(#ground)" fillOpacity="0.82" stroke="#9aa0ab" strokeWidth="1" />
    </svg>
  );
}
