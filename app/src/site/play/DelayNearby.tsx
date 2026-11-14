/** "Mission delayed": search the surrounding region for spots that are better at the new date. */
import { useEffect, useState } from "react";
import { SYNODIC_DAYS } from "../../astro/analysis";
import type { DelayResult } from "../../optim/delay";
import { useData } from "../data/store";
import { useI18n, type MessageKey } from "../i18n";
import { delayedNeighbourhood } from "./nearby";

const VERDICT: Record<DelayResult["verdict"], MessageKey> = {
  "toujours bon": "delay.v.same", "dégradé": "delay.v.worse", "amélioré": "delay.v.better",
  "devient infaisable": "delay.v.lost", "devient faisable": "delay.v.gained", "infaisable": "delay.v.never",
};

interface Props { lat: number; lon: number; start: number; hours: number; onOpen: (lat: number, lon: number, start: number) => void }

export function DelayNearby({ lat, lon, start, hours, onOpen }: Props) {
  const { t, fmt } = useI18n();
  const { lro } = useData();
  const [state, setState] = useState<{ kind: "idle" } | { kind: "run"; f: number } | { kind: "none" } | { kind: "error" } | { kind: "done"; r: DelayResult & { regionId: string } }>({ kind: "idle" });
  useEffect(() => setState({ kind: "idle" }), [lat, lon, start, hours]);
  const delayH = SYNODIC_DAYS * 24;
  const run = () => {
    setState({ kind: "run", f: 0 });
    delayedNeighbourhood(lat, lon, start, hours, delayH, lro, (f) => setState({ kind: "run", f }))
      .then((r) => setState(r ? { kind: "done", r } : { kind: "none" }))
      .catch(() => setState({ kind: "error" }));
  };

  if (state.kind === "idle") return <button className="btn btn-primary btn-small" onClick={run}>{t("delay.search")}</button>;
  if (state.kind === "run") return <p className="small muted" role="status">{t("delay.running", { pct: Math.round(state.f * 100) })}</p>;
  if (state.kind === "none") return <p className="small faint">{t("delay.noRegion")}</p>;
  if (state.kind === "error") return <p className="small faint">{t("delay.error")}</p>;
  const { r } = state;
  return (
    <div className="delay-nearby">
      <p><strong>{t(VERDICT[r.verdict])}</strong> <span className="muted small">{t("delay.score", { before: Number.isNaN(r.before.score) ? "-" : fmt.num(r.before.score, 0), after: Number.isNaN(r.after.score) ? "-" : fmt.num(r.after.score, 0) })}</span></p>
      {r.alternatives.length === 0 ? <p className="small faint">{t("delay.noAlt")}</p> : (
        <table className="table">
          <thead><tr><th>#</th><th>{t("delay.distance")}</th><th>{t("lab.col.score")}</th><th>{t("body.sun")}</th><th>{t("body.earth")}</th><th></th></tr></thead>
          <tbody>{r.alternatives.slice(0, 3).map((z) => (
            <tr key={z.rank}>
              <td>{z.rank}</td><td>{fmt.num(z.distKm, 1)} km</td><td>{fmt.num(z.score, 0)}</td><td>{fmt.pct(z.sunPct)}</td><td>{fmt.pct(z.earthPct)}</td>
              <td><button className="btn btn-ghost btn-small" onClick={() => onOpen(z.lat, z.lon, start + delayH * 3_600_000)}>{t("lab.open")}</button></td>
            </tr>
          ))}</tbody>
        </table>
      )}
      <p className="small faint">{t("delay.method", { region: t(`zone.region.${r.regionId}` as MessageKey) })}</p>
    </div>
  );
}
