import { useMemo, useState } from "react";
import type { Sample } from "../astro/analysis";
import { sunUp, earthUp } from "../astro/analysis";
import { BANDS, budget, STATIONS, VEHICLES, antennaGainDb, type Band, type Station, type Vehicle } from "../astro/budget";
import { fmtDate, fmtDuration, fmtNum } from "../format";

interface Props {
  samples: Sample[];
  vehicle: Vehicle;
  onVehicle: (v: Vehicle) => void;
}

const fmtRate = (bps: number) => (bps >= 1e6 ? `${fmtNum(bps / 1e6, bps >= 1e7 ? 0 : 1)} Mbit/s` : `${fmtNum(bps / 1e3, 0)} kbit/s`);
const fmtWh = (wh: number) => (wh >= 1000 ? `${fmtNum(wh / 1000, wh >= 10000 ? 0 : 1)} kWh` : `${fmtNum(wh)} Wh`);
const fmtGb = (gb: number) => (gb >= 1 ? `${fmtNum(gb, gb >= 100 ? 0 : 1)} Go` : `${fmtNum(gb * 1000)} Mo`);

/** Number field bound to one vehicle parameter. */
function Field({ label, value, onChange, step = 1, unit, scale = 1 }: {
  label: string; value: number; onChange: (v: number) => void; step?: number; unit?: string; scale?: number;
}) {
  return (
    <label className="bfield">{label}
      <span>
        <input type="number" value={+(value * scale).toFixed(3)} step={step} min={0}
          onChange={(e) => { const x = parseFloat(e.target.value); if (Number.isFinite(x) && x >= 0) onChange(x / scale); }} />
        {unit && <small>{unit}</small>}
      </span>
    </label>
  );
}

export function BudgetPanel({ samples, vehicle: v, onVehicle }: Props) {
  const [open, setOpen] = useState(false);
  const r = useMemo(() => budget(v, samples), [v, samples]);
  const set = (patch: Partial<Vehicle>) => onVehicle({ ...v, ...patch, label: "Personnalisé" });
  const presetKey = Object.entries(VEHICLES).find(([, p]) => p.label === v.label)?.[0] ?? "custom";
  const stationOk = STATIONS[v.station].gt[v.band] !== undefined;

  // State-of-charge chart
  const W = 1000, H = 120, PL = 44, PR = 12, PT = 8, PB = 18;
  const t0 = samples[0].t, t1 = samples[samples.length - 1].t;
  const x = (t: number) => PL + ((t - t0) / Math.max(1, t1 - t0)) * (W - PL - PR);
  const y = (p: number) => PT + ((100 - p) / 100) * (H - PT - PB);
  const stride = Math.max(1, Math.floor(samples.length / 1000));
  let path = "";
  for (let i = 0; i < samples.length; i += stride) path += `${i ? "L" : "M"}${x(samples[i].t).toFixed(1)},${y(r.socPct[i]).toFixed(1)}`;
  const runs = (pred: (s: Sample) => boolean) => {
    const out: [number, number][] = [];
    let a: number | null = null;
    samples.forEach((s, i) => {
      if (pred(s) && a === null) a = s.t;
      if ((!pred(s) || i === samples.length - 1) && a !== null) { out.push([a, s.t]); a = null; }
    });
    return out;
  };
  const floor = 100 * (1 - v.dod);

  return (
    <div className="budget">
      <div className="budget-head">
        <label>Véhicule de référence
          <select value={presetKey} onChange={(e) => { const p = VEHICLES[e.target.value]; if (p) onVehicle(p); }}>
            {Object.entries(VEHICLES).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}
            {presetKey === "custom" && <option value="custom">Personnalisé</option>}
          </select>
        </label>
        <span className="muted">
          {fmtNum(v.panelM2, 1)} m² de panneaux {v.panelMount === "vertical" ? "verticaux orientables" : "horizontaux"} ·
          {" "}{fmtNum(v.dayW)} W le jour, {fmtNum(v.nightW)} W la nuit · batterie {fmtWh(v.batteryWh)} ·
          {" "}{BANDS[v.band].label}, {fmtNum(v.txW)} W, antenne {fmtNum(v.antennaM, 1)} m → {STATIONS[v.station].label}
        </span>
        <button className="link" onClick={() => setOpen(!open)}>{open ? "Masquer les paramètres" : "Modifier les paramètres"}</button>
      </div>

      {open && (
        <div className="bparams">
          <fieldset>
            <legend>Énergie</legend>
            <Field label="Panneaux" value={v.panelM2} step={0.5} unit="m²" onChange={(x) => set({ panelM2: Math.max(0.01, x) })} />
            <Field label="Rendement" value={v.panelEff} step={1} unit="%" scale={100} onChange={(x) => set({ panelEff: Math.min(1, x) })} />
            <label className="bfield">Montage
              <select value={v.panelMount} onChange={(e) => set({ panelMount: e.target.value as Vehicle["panelMount"] })}>
                <option value="vertical">Vertical, orienté vers le Soleil</option>
                <option value="horizontal">Horizontal (sur le pont)</option>
              </select>
            </label>
            <Field label="Conso. de jour" value={v.dayW} step={10} unit="W" onChange={(x) => set({ dayW: x })} />
            <Field label="Conso. de nuit (survie)" value={v.nightW} step={10} unit="W" onChange={(x) => set({ nightW: x })} />
            <Field label="Batterie" value={v.batteryWh} step={100} unit="Wh" onChange={(x) => set({ batteryWh: Math.max(1, x) })} />
            <Field label="Profondeur de décharge" value={v.dod} step={5} unit="%" scale={100} onChange={(x) => set({ dod: Math.min(1, Math.max(0.05, x)) })} />
          </fieldset>
          <fieldset>
            <legend>Télécom (liaison directe Terre)</legend>
            <label className="bfield">Bande
              <select value={v.band} onChange={(e) => set({ band: e.target.value as Band })}>
                {(Object.keys(BANDS) as Band[]).map((b) => <option key={b} value={b}>{BANDS[b].label}</option>)}
              </select>
            </label>
            <Field label="Puissance émise" value={v.txW} step={5} unit="W" onChange={(x) => set({ txW: Math.max(0.1, x) })} />
            <Field label="Antenne (diamètre)" value={v.antennaM} step={0.1} unit="m" onChange={(x) => set({ antennaM: Math.max(0.05, x) })} />
            <label className="bfield">Station au sol
              <select value={v.station} onChange={(e) => set({ station: e.target.value as Station })}>
                {(Object.keys(STATIONS) as Station[]).map((k) => <option key={k} value={k}>{STATIONS[k].label}</option>)}
              </select>
            </label>
            <Field label="Temps de station" value={v.stationHoursPerDay} step={1} unit="h/jour" onChange={(x) => set({ stationHoursPerDay: Math.min(24, x) })} />
            <Field label="Débit max de la radio" value={v.maxRateMbps} step={0.5} unit="Mbit/s" onChange={(x) => set({ maxRateMbps: Math.max(0.001, x) })} />
          </fieldset>
        </div>
      )}

      <div className="cards">
        <div className={`card frag ${r.survives ? "ok" : "bad"}`}>
          <div className="card-k">Bilan énergétique</div>
          <div className="card-v">{r.survives ? "Tient la période" : "Panne d'énergie"}</div>
          <div className="card-s">
            {r.survives
              ? <>Batterie au plus bas : <b>{fmtNum(r.minSocPct)} %</b> (plancher {fmtNum(floor)} %)</>
              : <>Batterie vide pendant <b>{fmtDuration(r.brownoutH)}</b></>}
            <br />Production moyenne {fmtNum(r.genMeanW)} W · consommation {fmtNum(r.loadMeanW)} W
          </div>
        </div>
        <div className="card">
          <div className="card-k">Dimensionnement pour ce site et cette période</div>
          <div className="card-v">{fmtWh(r.batteryNeededWh)}</div>
          <div className="card-s">
            de batterie avec {fmtNum(v.panelM2, 1)} m² de panneaux
            <br />{r.panelNeededM2 === null
              ? <>Avec {fmtWh(v.batteryWh)} : <b>impossible</b> quelle que soit la surface (nuit trop longue)</>
              : <>Avec {fmtWh(v.batteryWh)} : <b>{fmtNum(r.panelNeededM2, 1)} m²</b> de panneaux suffisent</>}
          </div>
        </div>
        <div className="card earth">
          <div className="card-k">Débit vers la Terre</div>
          {stationOk && r.link ? <>
            <div className="card-v">{fmtRate(r.link.rateBps)}</div>
            <div className="card-s">
              Marge {fmtNum(r.link.marginDb, 0)} dB · antenne {fmtNum(antennaGainDb(v), 1)} dBi
              <br />Distance {fmtNum((r.linkNear?.rangeKm ?? 0) / 1000)}–{fmtNum((r.linkFar?.rangeKm ?? 0) / 1000)} milliers de km
            </div>
          </> : <>
            <div className="card-v">—</div>
            <div className="card-s">{STATIONS[v.station].label} ne reçoit pas la {BANDS[v.band].label.toLowerCase()}.</div>
          </>}
        </div>
        <div className="card both">
          <div className="card-k">Données transmises (période)</div>
          <div className="card-v">{fmtGb(r.dataGb)}</div>
          <div className="card-s">
            {fmtDuration(r.linkHours)} de liaison utile
            <br />Terre visible, énergie disponible, {fmtNum(v.stationHoursPerDay)} h de station par jour
          </div>
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="chart soc" role="img" aria-label="Charge de la batterie au cours de la période">
        {runs(sunUp).map(([a, b], i) => <rect key={`s${i}`} x={x(a)} width={Math.max(1, x(b) - x(a))} y={PT} height={H - PT - PB} className="soc-sun" />)}
        {runs(earthUp).map(([a, b], i) => <rect key={`e${i}`} x={x(a)} width={Math.max(1, x(b) - x(a))} y={H - PB + 4} height={4} className="soc-earth" />)}
        {[0, 50, 100].map((p) => (
          <g key={p}>
            <line x1={PL} x2={W - PR} y1={y(p)} y2={y(p)} className="grid" />
            <text x={PL - 6} y={y(p) + 4} className="axis" textAnchor="end">{p} %</text>
          </g>
        ))}
        <line x1={PL} x2={W - PR} y1={y(floor)} y2={y(floor)} className="soc-floor" />
        <path d={path} className="soc-line" />
        <text x={PL} y={H - 1} className="axis">{fmtDate(t0, false)}</text>
        <text x={W - PR} y={H - 1} className="axis" textAnchor="end">{fmtDate(t1, false)}</text>
      </svg>
      <div className="legend">
        <span><i className="sw soc" />Charge de la batterie</span>
        <span><i className="sw sun" />Soleil visible (fond)</span>
        <span><i className="sw earth" />Terre visible (trait du bas)</span>
        <span><i className="sw floor" />Plancher de décharge</span>
      </div>
    </div>
  );
}
