/**
 * Timeline of a period: elevation of the Sun (pale gold) and the Earth (ice green), dotted lines
 * for the horizon in their direction, and visibility bands. Cursor movable by pointer or keyboard.
 */
import { useMemo, useRef, type KeyboardEvent, type PointerEvent } from "react";
import { windows, type Sample, type Window } from "../../astro/analysis";
import { useI18n } from "../i18n";
import { niceTicks } from "./geometry";

interface Props {
  samples: Sample[];
  cursor: number;
  onCursor?: (i: number) => void;
  relayWindows?: { start: number; end: number }[] | null;
  uncertain?: Window[];
  compact?: boolean;
  showElevation?: boolean;
}

export function TimelineChart({ samples, cursor, onCursor, relayWindows, uncertain, compact = false, showElevation = true }: Props) {
  const { t, fmt } = useI18n();
  const ref = useRef<SVGSVGElement>(null);
  const W = 1000, PL = 84, PR = 12, PT = 12, BAND = 12, GAP = 8;
  const rows: { key: string; cls: string; ws: { start: number; end: number }[] }[] = useMemo(() => {
    const r: { key: string; cls: string; ws: { start: number; end: number }[] }[] = [
      { key: t("tl.band.sun"), cls: "band-sun", ws: windows(samples, (s) => s.sunFrac >= 0.5) },
      { key: t("tl.band.earth"), cls: "band-earth", ws: windows(samples, (s) => s.earthFrac >= 0.5) },
    ];
    if (relayWindows) r.push({ key: t("tl.band.relay"), cls: "band-relay", ws: relayWindows });
    if (uncertain) r.push({ key: t("tl.band.uncertain"), cls: "band-uncertain", ws: uncertain });
    return r;
  }, [samples, relayWindows, uncertain, t]);
  const plotH = showElevation ? (compact ? 150 : 200) : 0;
  const bandsY = PT + plotH + (showElevation ? 22 : 0);
  const H = bandsY + rows.length * (BAND + GAP) + 26;
  const t0 = samples[0]?.t ?? 0, t1 = samples[samples.length - 1]?.t ?? 1;
  const x = (tt: number) => PL + ((tt - t0) / Math.max(1, t1 - t0)) * (W - PL - PR);

  const { lo, hi } = useMemo(() => {
    let l = 0, h = 0;
    for (const s of samples) { l = Math.min(l, s.sAlt, s.eAlt); h = Math.max(h, s.sAlt, s.eAlt); }
    return { lo: Math.max(-20, Math.floor(l - 1)), hi: Math.min(90, Math.ceil(h + 1)) };
  }, [samples]);
  const y = (v: number) => PT + ((hi - Math.max(lo, Math.min(hi, v))) / Math.max(1, hi - lo)) * plotH;
  const line = (f: (s: Sample) => number) => {
    const stride = Math.max(1, Math.floor(samples.length / 1200));
    let d = "";
    for (let i = 0; i < samples.length; i += stride) d += `${i ? " L" : "M"}${x(samples[i].t).toFixed(1)},${y(f(samples[i])).toFixed(1)}`;
    return d;
  };

  const n = samples.length;
  const setFromPointer = (e: PointerEvent) => {
    if (!onCursor || !ref.current || (e.type === "pointermove" && e.buttons !== 1)) return;
    const r = ref.current.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (((e.clientX - r.left) / r.width) * W - PL) / (W - PL - PR)));
    onCursor(Math.round(f * (n - 1)));
  };
  const onKey = (e: KeyboardEvent) => {
    if (!onCursor) return;
    const big = Math.max(1, Math.round(n / 30));
    const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : e.key === "PageUp" ? big : e.key === "PageDown" ? -big : 0;
    if (!d) return;
    e.preventDefault();
    onCursor(Math.min(n - 1, Math.max(0, cursor + d)));
  };
  const cur = samples[Math.min(Math.max(cursor, 0), n - 1)];
  const ticks = Array.from({ length: 5 }, (_, i) => t0 + ((t1 - t0) * i) / 4);

  return (
    <svg ref={ref} viewBox={`0 0 ${W} ${H}`} className={onCursor ? "viz viz-timeline interactive" : "viz viz-timeline"}
      role={onCursor ? "slider" : "img"} aria-label={onCursor ? t("tl.cursor") : t("tl.aria")} tabIndex={onCursor ? 0 : undefined}
      aria-valuemin={onCursor ? 0 : undefined} aria-valuemax={onCursor ? n - 1 : undefined} aria-valuenow={onCursor ? cursor : undefined}
      aria-valuetext={onCursor && cur ? fmt.dateTime(cur.t) : undefined}
      onPointerDown={setFromPointer} onPointerMove={setFromPointer} onKeyDown={onKey}>
      {showElevation && (
        <g>
          {niceTicks(lo, hi).map((v) => (
            <g key={v}>
              <line x1={PL} x2={W - PR} y1={y(v)} y2={y(v)} className={v === 0 ? "viz-grid zero" : "viz-grid"} />
              <text x={PL - 8} y={y(v) + 4} className="viz-axis" textAnchor="end">{v}°</text>
            </g>
          ))}
          <path d={line((s) => s.eHz)} className="hz-line earth" />
          <path d={line((s) => s.sHz)} className="hz-line sun" />
          <path d={line((s) => s.eAlt)} className="elev-line earth" />
          <path d={line((s) => s.sAlt)} className="elev-line sun" />
        </g>
      )}
      {rows.map((r, i) => {
        const yy = bandsY + i * (BAND + GAP);
        return (
          <g key={r.key}>
            <text x={PL - 10} y={yy + 10} className="viz-axis" textAnchor="end">{r.key}</text>
            <rect x={PL} y={yy} width={W - PL - PR} height={BAND} className="band-bg" rx={3} />
            {r.ws.map((w, j) => (
              <rect key={j} x={x(w.start)} y={yy} width={Math.max(1.5, x(w.end) - x(w.start))} height={BAND} className={r.cls} rx={2} />
            ))}
          </g>
        );
      })}
      {ticks.map((tt, i) => (
        <text key={i} x={x(tt)} y={H - 6} className="viz-axis" textAnchor={i === 0 ? "start" : i === 4 ? "end" : "middle"}>{fmt.date(tt)}</text>
      ))}
      {cur && <line x1={x(cur.t)} x2={x(cur.t)} y1={PT} y2={bandsY + rows.length * (BAND + GAP)} className="viz-cursor" />}
    </svg>
  );
}
