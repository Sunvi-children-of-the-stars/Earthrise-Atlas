import type { Fragility, Metrics } from "../astro/analysis";
import type { SiteRecord } from "../data";
import type { RelayResult } from "../astro/relay";
import { fmtDate, fmtDeg, fmtDuration, fmtNum, fmtPct } from "../format";

export interface Scenario { key: string; site: SiteRecord; start: number; hours: number }
export interface Row { sc: Scenario; m: Metrics; f: Fragility; relay: RelayResult | null }

type Col = { label: string; get: (m: Metrics) => number; fmt: (v: number) => string; better: "max" | "min"; hint: string };

const COLS: Col[] = [
  { label: "Soleil", get: (m) => m.sunPct, fmt: fmtPct, better: "max", hint: "Part du temps où le Soleil est visible" },
  { label: "Plus longue nuit", get: (m) => m.longestNightH, fmt: fmtDuration, better: "min", hint: "Durée maximale sans Soleil (batteries, survie thermique)" },
  { label: "Flux moyen", get: (m) => m.meanPowerVertical, fmt: (v) => `${fmtNum(v)} W/m²`, better: "max", hint: "Panneau vertical orientable" },
  { label: "Soleil max", get: (m) => m.sunMaxAlt, fmt: (v) => fmtDeg(v), better: "max", hint: "Élévation solaire maximale" },
  { label: "Terre", get: (m) => m.earthPct, fmt: fmtPct, better: "max", hint: "Part du temps avec liaison directe possible" },
  { label: "Plus longue coupure", get: (m) => m.longestNoEarthH, fmt: fmtDuration, better: "min", hint: "Durée maximale sans Terre visible" },
  { label: "Soleil + Terre", get: (m) => m.bothPct, fmt: fmtPct, better: "max", hint: "Énergie et communication simultanées" },
];

interface Props { rows: Row[]; onRemove: (key: string) => void; onOpen: (sc: Scenario) => void }

export function Comparison({ rows, onRemove, onOpen }: Props) {
  if (!rows.length) {
    return <p className="muted">Aucun scénario. Ajoutez le scénario courant, ou comparez tous les candidats à la date choisie.</p>;
  }
  const best = COLS.map((c) => {
    const vals = rows.map((r) => c.get(r.m));
    return c.better === "max" ? Math.max(...vals) : Math.min(...vals);
  });
  return (
    <div className="table-wrap">
      <table className="cmp">
        <thead>
          <tr>
            <th>Site</th>
            <th>Début · durée</th>
            {COLS.map((c) => <th key={c.label} title={c.hint}>{c.label}</th>)}
            <th title="Part du temps avec une liaison possible : Terre visible OU relais LRO au-dessus de l'horizon (≥ 5°)">Terre ou LRO</th>
            <th title="Plus longue période sans Terre ni relais LRO">Coupure totale max</th>
            <th title="Robustesse du résultat si l’horizon est faux de ±0,5° ou si un relief lointain (> 100 km) décide de la visibilité">Fiabilité</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.sc.key}>
              <td>
                <button className="link" onClick={() => onOpen(r.sc)}>{r.sc.site.short}</button>
              </td>
              <td className="nowrap">{fmtDate(r.sc.start)} · {fmtDuration(r.sc.hours)}</td>
              {COLS.map((c, i) => {
                const v = c.get(r.m);
                const isBest = rows.length > 1 && Math.abs(v - best[i]) < 1e-6;
                return <td key={c.label} className={isBest ? "best num" : "num"}>{c.fmt(v)}</td>;
              })}
              <td className="num">{r.relay?.available ? fmtPct(r.relay.linkPct) : "—"}</td>
              <td className="num">{r.relay?.available ? fmtDuration(r.relay.longestNoLinkH) : "—"}</td>
              <td><span className={`badge-frag ${r.f.level === "robuste" ? "ok" : r.f.level === "fragile" ? "bad" : "mid"}`}>{r.f.level}</span></td>
              <td><button className="icon" onClick={() => onRemove(r.sc.key)} aria-label="Retirer">✕</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
