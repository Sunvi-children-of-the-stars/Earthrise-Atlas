import type { MonthStat } from "../astro/analysis";
import { fmtDate, fmtDuration, fmtPct } from "../format";

const W = 640, H = 260, PL = 36, PR = 8, PT = 10, PB = 34;

interface Props { stats: MonthStat[]; current: number; onPick: (t: number) => void }

/** Sun / Earth percentage per lunar month: which month should we land in? */
export function Seasonal({ stats, current, onPick }: Props) {
  const bw = (W - PL - PR) / stats.length;
  const y = (p: number) => PT + ((100 - p) / 100) * (H - PT - PB);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img"
      aria-label="Ensoleillement et visibilité de la Terre par mois lunaire">
      {[0, 50, 100].map((v) => (
        <g key={v}>
          <line x1={PL} x2={W - PR} y1={y(v)} y2={y(v)} className="grid" />
          <text x={PL - 6} y={y(v) + 4} className="axis" textAnchor="end">{v}%</text>
        </g>
      ))}
      {stats.map((s, i) => {
        const x0 = PL + i * bw;
        const active = current >= s.start && current < s.start + 29.53 * 86_400_000;
        return (
          <g key={i} className={active ? "month active" : "month"} onClick={() => onPick(s.start)}>
            <title>
              {`Mois lunaire débutant le ${fmtDate(s.start, false)}\nSoleil ${fmtPct(s.sunPct)} · Terre ${fmtPct(s.earthPct)}\nPlus longue nuit ${fmtDuration(s.longestNightH)}`}
            </title>
            <rect x={x0 + 1} y={PT} width={bw - 2} height={H - PT - PB} className="month-bg" />
            <rect x={x0 + bw * 0.14} width={bw * 0.34} y={y(s.sunPct)} height={y(0) - y(s.sunPct)} className="bar sun" />
            <rect x={x0 + bw * 0.52} width={bw * 0.34} y={y(s.earthPct)} height={y(0) - y(s.earthPct)} className="bar earth" />
            <text x={x0 + bw / 2} y={H - 18} className="axis" textAnchor="middle">
              {fmtDate(s.start, false).slice(0, 5)}
            </text>
            <text x={x0 + bw / 2} y={H - 4} className="axis dim" textAnchor="middle">
              {fmtDuration(s.longestNightH)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
