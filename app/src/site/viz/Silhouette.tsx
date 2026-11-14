/** Decorative lunar relief drawn from a real horizon mask (vertical scale exaggerated). */
import { useMemo } from "react";
import { horizonAt, type HorizonMask } from "../../astro/horizon";

interface Props { mask: HorizonMask; height?: number; exaggeration?: number; className?: string }

export function Silhouette({ mask, height = 160, exaggeration = 10, className = "" }: Props) {
  const W = 1200;
  const d = useMemo(() => {
    const els = Array.from({ length: 241 }, (_, i) => horizonAt(mask, 90 + (i / 240) * 180));
    const base = Math.min(...els);
    const pts = els.map((e, i) => `${((i / 240) * W).toFixed(1)},${(height - 18 - (e - base) * exaggeration).toFixed(1)}`);
    return { fill: `M0,${height} L${pts.join(" L")} L${W},${height} Z`, line: `M${pts.join(" L")}` };
  }, [mask, height, exaggeration]);
  return (
    <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" className={`silhouette ${className}`} aria-hidden="true">
      <path d={d.fill} fill="var(--bg-2)" />
      <path d={d.line} fill="none" stroke="var(--line-strong)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
