import { useState } from "react";
import type { Vehicle } from "../astro/budget";
import { loadMask } from "../astro/horizon";
import { explain, scanSite, scoreScans, topCandidates, WEIGHTS, type LandingCandidate, type SiteScan } from "../astro/landing";
import type { SiteRecord } from "../data";
import { fmtDate, fmtDuration, fmtNum, fmtPct, toInput, fromInput } from "../format";

interface Props {
  sites: SiteRecord[];
  vehicle: Vehicle;
  defaultFrom: number;
  onAnalyze: (site: SiteRecord, start: number, hours: number) => void;
}

const MONTHS = [3, 6, 12];
const MISSIONS = [{ d: 7, label: "7 jours" }, { d: 14, label: "14 jours" }, { d: 29.5, label: "1 jour lunaire (29,5 j)" }];

/** Score colour: grey when infeasible, then red → yellow → green. */
function color(c: LandingCandidate): string {
  if (!c.feasible) return "var(--line)";
  const f = Math.max(0, Math.min(1, (c.score - 40) / 50));
  return `hsl(${Math.round(10 + 120 * f)} 65% ${Math.round(38 + 10 * f)}%)`;
}

export function LandingPlanner({ sites, vehicle, defaultFrom, onAnalyze }: Props) {
  const candidates = sites.filter((s) => s.category === "candidat");
  const [from, setFrom] = useState(() => Math.floor(defaultFrom / 86_400_000) * 86_400_000);
  const [months, setMonths] = useState(6);
  const [missionDays, setMissionDays] = useState(14);
  const [holdH, setHoldH] = useState(6);
  const [busy, setBusy] = useState<string | null>(null);
  const [scans, setScans] = useState<SiteScan[] | null>(null);
  const [ran, setRan] = useState<{ missionDays: number; vehicle: string } | null>(null);
  const [hover, setHover] = useState<LandingCandidate | null>(null);

  const run = async () => {
    const to = from + months * 30.44 * 86_400_000;
    const out: SiteScan[] = [];
    for (const s of candidates) {
      setBusy(`Simulation de ${s.short}…`);
      await new Promise((r) => setTimeout(r, 20)); // let the message render
      const mask = await loadMask(s.id);
      out.push(scanSite(s, mask, vehicle, { from, to, missionDays, everyH: 12, landingHoldH: holdH }));
    }
    scoreScans(out, missionDays);
    setScans(out);
    setRan({ missionDays, vehicle: vehicle.label });
    setBusy(null);
  };

  const top = scans ? topCandidates(scans) : [];
  const t0 = scans?.[0]?.candidates[0]?.start ?? 0;
  const t1 = scans?.[0]?.candidates.at(-1)?.start ?? 1;
  const W = 1000, PL = 130, PR = 10, ROW = 36;

  return (
    <div className="landing">
      <div className="ctrl-row">
        <label>Premier atterrissage possible (UTC)
          <input type="date" value={toInput(from).slice(0, 10)}
            onChange={(e) => { const t = fromInput(`${e.target.value}T00:00`); if (!Number.isNaN(t)) setFrom(t); }} />
        </label>
        <label>Fenêtre de recherche
          <select value={months} onChange={(e) => setMonths(Number(e.target.value))}>
            {MONTHS.map((m) => <option key={m} value={m}>{m} mois</option>)}
          </select>
        </label>
        <label>Durée de la mission
          <select value={missionDays} onChange={(e) => setMissionDays(Number(e.target.value))}>
            {MISSIONS.map((m) => <option key={m.d} value={m.d}>{m.label}</option>)}
          </select>
        </label>
        <label>Soleil + Terre exigés après l'atterrissage
          <select value={holdH} onChange={(e) => setHoldH(Number(e.target.value))}>
            {[0.5, 6, 24, 48].map((h) => <option key={h} value={h}>{h < 1 ? "30 min" : `${h} h`}</option>)}
          </select>
        </label>
        <div className="btns">
          <button className="primary" disabled={!!busy} onClick={run}>{busy ?? "Chercher les meilleures dates"}</button>
        </div>
      </div>
      <p className="hint">
        Véhicule : <b>{vehicle.label}</b> (réglable dans le bilan énergie et télécom). Une date testée toutes les 12 h
        sur les {candidates.length} sites candidats. Note sur 100 : Soleil {WEIGHTS.sun * 100} %, Terre {WEIGHTS.earth * 100} %,
        absence de longue nuit {WEIGHTS.night * 100} %, tolérance au retard {WEIGHTS.slip * 100} %, données {WEIGHTS.data * 100} %, réserve de batterie {WEIGHTS.battery * 100} %.
        Une date est <b>exclue</b> (gris) si le Soleil ou la Terre manquent juste après l'atterrissage, ou si la batterie se vide.
      </p>

      {scans && ran && (
        <>
          {(ran.missionDays !== missionDays || ran.vehicle !== vehicle.label) && (
            <p className="frag-note">⚠ Paramètres modifiés depuis le calcul : relancez la recherche.</p>
          )}
          <svg viewBox={`0 0 ${W} ${scans.length * ROW + 24}`} className="chart landing-strip" role="img"
            aria-label="Note de chaque date d'atterrissage, par site" onMouseLeave={() => setHover(null)}>
            {scans.map((sc, r) => {
              const w = (W - PL - PR) / Math.max(1, sc.candidates.length);
              return (
                <g key={sc.siteId}>
                  <text x={PL - 8} y={r * ROW + 15} className="axis" textAnchor="end">{sc.siteName}</text>
                  {sc.candidates.map((c, i) => (
                    <rect key={i} x={PL + i * w} y={r * ROW + 2} width={w + 0.3} height={ROW - 5} fill={color(c)}
                      className="lcell" onMouseEnter={() => setHover(c)}
                      onClick={() => { const s = sites.find((x) => x.id === c.siteId); if (s) onAnalyze(s, c.start, ran.missionDays * 24); }} />
                  ))}
                </g>
              );
            })}
            {Array.from({ length: 7 }, (_, i) => t0 + ((t1 - t0) * i) / 6).map((t, i) => (
              <text key={i} x={PL + ((W - PL - PR) * i) / 6} y={scans.length * ROW + 16} className="axis"
                textAnchor={i === 0 ? "start" : i === 6 ? "end" : "middle"}>{fmtDate(t, false)}</text>
            ))}
          </svg>
          <div className="lhover">
            {hover
              ? <>
                  <b>{hover.siteName}, {fmtDate(hover.start)}</b> —{" "}
                  {hover.feasible
                    ? <>note <b>{fmtNum(hover.score)}</b> · Soleil {fmtPct(hover.sunPct)} · Terre {fmtPct(hover.earthPct)} ·
                        nuit max {fmtDuration(hover.longestNightH)} · retard toléré {fmtDuration(hover.slipDays * 24)} · batterie min {fmtPct(hover.minSocPct)} · {fmtNum(hover.dataGb, 1)} Go</>
                    : <>exclue : {hover.reasons.join(" ; ")}</>}
                  <span className="muted"> (cliquer pour analyser)</span>
                </>
              : <span className="muted">Survolez une case : une case = une date d'atterrissage. Vert = meilleure note, gris = exclue.</span>}
          </div>

          <h4>Meilleures fenêtres d'atterrissage</h4>
          {top.length === 0
            ? <p className="hint">Aucune date ne remplit les conditions : allongez la fenêtre de recherche, réduisez la durée exigée après l'atterrissage ou renforcez la batterie.</p>
            : (
              <div className="table-wrap">
                <table className="cmp">
                  <thead>
                    <tr><th>#</th><th>Site</th><th>Atterrissage</th><th>Note</th><th>Pour</th><th>Contre</th><th /></tr>
                  </thead>
                  <tbody>
                    {top.map((c, i) => {
                      const e = explain(c, ran.missionDays);
                      return (
                        <tr key={`${c.siteId}${c.start}`}>
                          <td>{i + 1}</td>
                          <td>{c.siteName}</td>
                          <td>{fmtDate(c.start)}</td>
                          <td><b>{fmtNum(c.score)}</b></td>
                          <td className="pros">{e.pros.join(" · ")}</td>
                          <td className="cons">{e.cons.length ? e.cons.join(" · ") : "—"}</td>
                          <td><button className="link" onClick={() => { const s = sites.find((x) => x.id === c.siteId); if (s) onAnalyze(s, c.start, ran.missionDays * 24); }}>Analyser</button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          <SiteSummary scans={scans} />
        </>
      )}
    </div>
  );
}

/** Share of feasible dates and best score per site: how "forgiving" each site is about the date. */
function SiteSummary({ scans }: { scans: SiteScan[] }) {
  return (
    <p className="hint">
      {scans.map((s) => {
        const ok = s.candidates.filter((c) => c.feasible);
        const best = Math.max(0, ...ok.map((c) => c.score));
        return <span key={s.siteId} className="lsum"><b>{s.siteName}</b> : {fmtPct((100 * ok.length) / Math.max(1, s.candidates.length))} des dates possibles, meilleure note {fmtNum(best)}. </span>;
      })}
    </p>
  );
}
