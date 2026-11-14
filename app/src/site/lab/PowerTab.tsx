/** Power & radio: energy and link budget of a reference vehicle at the chosen site and period, and relay options. */
import { useMemo, useState } from "react";
import type { Sample } from "../../astro/analysis";
import { BANDS, budget, STATIONS, VEHICLES, type Band, type Station, type Vehicle } from "../../astro/budget";
import type { HorizonMask } from "../../astro/horizon";
import { relayAnalysis } from "../../astro/relay";
import type { SiteRecord } from "../../data";
import { useData } from "../data/store";
import { relayLabel, useI18n, type MessageKey } from "../i18n";
import { StatCard } from "../ui/StatCard";

const VEHICLE_KEYS: Record<string, MessageKey> = { lander: "vehicle.lander", rover: "vehicle.rover", base: "vehicle.base" };

function Num({ label, value, onChange, step = 1 }: { label: string; value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <label className="field">{label}
      <input type="number" min={0} step={step} value={value} onChange={(e) => { const x = parseFloat(e.target.value); if (Number.isFinite(x) && x >= 0) onChange(x); }} />
    </label>
  );
}

export function PowerTab({ site, mask, samples, start, hours }: { site: SiteRecord; mask: HorizonMask | null; samples: Sample[]; start: number; hours: number }) {
  const { t, fmt } = useI18n();
  const { relays, ephReady } = useData();
  const [preset, setPreset] = useState("lander");
  const [v, setV] = useState<Vehicle>(VEHICLES.lander);
  const r = useMemo(() => (samples.length ? budget(v, samples) : null), [v, samples]);
  const relayRows = useMemo(() => (mask && ephReady ? relays.map((rel) => ({ rel, a: relayAnalysis(site, mask, rel, start, hours) })) : []),
    [relays, site, mask, start, hours, ephReady]);
  const set = (p: Partial<Vehicle>) => setV({ ...v, ...p });
  const wh = (x: number) => (x >= 1000 ? `${fmt.num(x / 1000, x >= 10_000 ? 0 : 1)} kWh` : `${fmt.num(x, 0)} Wh`);
  const rate = (bps: number) => (bps >= 1e6 ? `${fmt.num(bps / 1e6, 1)} Mbit/s` : `${fmt.num(bps / 1e3, 0)} kbit/s`);

  const curve = useMemo(() => {
    if (!r || !samples.length) return "";
    const W = 1000, H = 140, n = r.socPct.length;
    return Array.from(r.socPct, (s, i) => `${i ? "L" : "M"}${((i / Math.max(1, n - 1)) * W).toFixed(1)},${(H - (s / 100) * H).toFixed(1)}`).join(" ");
  }, [r, samples.length]);

  if (!r) return <p className="muted">{t("common.loading")}</p>;
  return (
    <div className="stack">
      <div className="row lab-row">
        <label className="field">{t("lab.vehicle")}
          <select value={preset} onChange={(e) => { setPreset(e.target.value); setV(VEHICLES[e.target.value]); }}>
            {Object.keys(VEHICLES).map((k) => <option key={k} value={k}>{t(VEHICLE_KEYS[k])}</option>)}
          </select>
        </label>
      </div>
      <div className="stats">
        <StatCard tone={r.survives ? "ok" : "warn"} label={t("lab.power.verdict")} value={r.survives ? t("play.ok") : t("play.notOk")}
          note={r.survives ? t("lab.power.minSoc", { v: fmt.pct(r.minSocPct) }) : t("lab.power.brownout", { h: fmt.hours(r.brownoutH) })} />
        <StatCard label={t("lab.power.battery")} value={wh(r.batteryNeededWh)} note={t("lab.power.batteryNote", { v: wh(v.batteryWh) })} />
        <StatCard label={t("lab.power.panels")} value={r.panelNeededM2 === null ? "-" : `${fmt.num(r.panelNeededM2, 1)} m²`}
          note={r.panelNeededM2 === null ? t("lab.power.panelsImpossible") : t("lab.power.panelsNote", { v: fmt.num(v.panelM2, 1) })} />
        <StatCard tone="earth" label={t("lab.power.data")} value={`${fmt.num(r.dataGb, r.dataGb >= 10 ? 0 : 1)} GB`}
          note={r.link ? t("lab.power.rate", { v: rate(r.link.rateBps) }) : t("lab.power.noStation")} />
      </div>
      <figure className="chapter-figure">
        <svg viewBox="0 0 1000 140" className="viz" preserveAspectRatio="none" role="img" aria-label={t("lab.power.curve")}>
          <line x1="0" x2="1000" y1={140 - (1 - v.dod) * 140} y2={140 - (1 - v.dod) * 140} className="viz-grid zero" />
          <path d={curve} className="elev-line earth" fill="none" />
        </svg>
        <figcaption>{t("lab.power.curve")}</figcaption>
      </figure>

      {relayRows.length > 0 && (
        <div>
          <h4>{t("lab.relays.title")}</h4>
          <table className="table">
            <thead><tr><th>{t("lab.relays.sat")}</th><th>{t("play.stat.relay")}</th><th>{t("lab.relays.outage")}</th><th>{t("lab.relays.passes")}</th></tr></thead>
            <tbody>{relayRows.map(({ rel, a }) => (
              <tr key={rel.meta.id}>
                <td>{relayLabel(rel.meta.id, t, rel.meta.satellite)}{rel.meta.kind === "model" ? <span className="badge">{t("lab.model")}</span> : null}</td>
                {a.available
                  ? <><td>{fmt.pct(a.linkPct)}</td><td>{fmt.hours(a.longestNoLinkH)}</td><td>{fmt.num(a.passesPerDay, 1)}</td></>
                  : <td colSpan={3} className="muted">{t("play.relay.na")}</td>}
              </tr>
            ))}</tbody>
          </table>
          <p className="small faint">{t("lab.relays.note")}</p>
        </div>
      )}

      <details className="advanced">
        <summary>{t("lab.advanced")}</summary>
        <div className="adv-grid">
          <Num label={t("lab.v.panel")} value={v.panelM2} step={0.1} onChange={(x) => set({ panelM2: x })} />
          <Num label={t("lab.v.eff")} value={v.panelEff} step={0.01} onChange={(x) => set({ panelEff: Math.min(1, x) })} />
          <Num label={t("lab.v.day")} value={v.dayW} onChange={(x) => set({ dayW: x })} />
          <Num label={t("lab.v.night")} value={v.nightW} onChange={(x) => set({ nightW: x })} />
          <Num label={t("lab.v.battery")} value={v.batteryWh} step={100} onChange={(x) => set({ batteryWh: x })} />
          <Num label={t("lab.v.tx")} value={v.txW} onChange={(x) => set({ txW: x })} />
          <Num label={t("lab.v.antenna")} value={v.antennaM} step={0.1} onChange={(x) => set({ antennaM: x })} />
          <label className="field">{t("lab.v.band")}
            <select value={v.band} onChange={(e) => set({ band: e.target.value as Band })}>{(Object.keys(BANDS) as Band[]).map((b) => <option key={b} value={b}>{BANDS[b].label}</option>)}</select></label>
          <label className="field">{t("lab.v.station")}
            <select value={v.station} onChange={(e) => set({ station: e.target.value as Station })}>{(Object.keys(STATIONS) as Station[]).map((s) => <option key={s} value={s}>{STATIONS[s].label}</option>)}</select></label>
        </div>
      </details>
    </div>
  );
}
