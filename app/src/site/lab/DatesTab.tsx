/** Landing dates: best windows for the candidate sites, and the year at a glance (site × lunar month). */
import { useEffect, useState } from "react";
import { VEHICLES } from "../../astro/budget";
import { loadMask } from "../../astro/horizon";
import { explain, scanSite, scoreScans, topCandidates, type LandingCandidate, type SiteScan } from "../../astro/landing";
import { PROFILES } from "../../optim/score";
import { useData } from "../data/store";
import { useI18n, type MessageKey } from "../i18n";
import { siteText } from "../i18n/sites";

interface Calendar { month_starts: string[]; sites: { id: string; cells: { grades: Record<string, number> }[] }[] }

const VEHICLE_KEYS: Record<string, MessageKey> = { lander: "vehicle.lander", rover: "vehicle.rover", base: "vehicle.base" };

export function DatesTab({ defaultFrom, onOpen }: { defaultFrom: number; onOpen: (siteId: string, start: number, hours: number) => void }) {
  const { t, fmt, lang } = useI18n();
  const { sites, ephReady } = useData();
  const candidates = sites.filter((s) => s.category === "candidat");
  const [from, setFrom] = useState(() => Math.floor(defaultFrom / 86_400_000) * 86_400_000);
  const [months, setMonths] = useState(6);
  const [missionDays, setMissionDays] = useState(14);
  const [vehicleId, setVehicleId] = useState("lander");
  const [busy, setBusy] = useState(false);
  const [top, setTop] = useState<LandingCandidate[] | null>(null);
  const [cal, setCal] = useState<Calendar | null>(null);
  const [calProfile, setCalProfile] = useState("lander");
  useEffect(() => { fetch("data/calendar/sites.json").then((r) => r.json()).then(setCal).catch(() => {}); }, []);

  const run = async () => {
    setBusy(true);
    await new Promise((r) => setTimeout(r, 30));
    const to = from + months * 30.44 * 86_400_000;
    const scans: SiteScan[] = [];
    for (const s of candidates) {
      const mask = await loadMask(s.id);
      scans.push(scanSite(s, mask, VEHICLES[vehicleId], { from, to, missionDays, everyH: 12, landingHoldH: 6 }));
    }
    scoreScans(scans, missionDays);
    setTop(topCandidates(scans));
    setBusy(false);
  };

  return (
    <div className="stack">
      <div className="row lab-row">
        <label className="field">{t("lab.dates.from")}
          <input type="date" value={new Date(from).toISOString().slice(0, 10)} onChange={(e) => { const v = Date.parse(e.target.value + "T00:00Z"); if (!Number.isNaN(v)) setFrom(v); }} />
        </label>
        <label className="field">{t("lab.dates.window")}
          <select value={months} onChange={(e) => setMonths(Number(e.target.value))}>{[3, 6, 12].map((m) => <option key={m} value={m}>{t("lab.months", { n: m })}</option>)}</select>
        </label>
        <label className="field">{t("lab.dates.mission")}
          <select value={missionDays} onChange={(e) => setMissionDays(Number(e.target.value))}>{[7, 14, 29.5].map((d) => <option key={d} value={d}>{t("lab.days", { n: fmt.num(d, d % 1 ? 1 : 0) })}</option>)}</select>
        </label>
        <label className="field">{t("lab.vehicle")}
          <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>{Object.keys(VEHICLES).map((k) => <option key={k} value={k}>{t(VEHICLE_KEYS[k])}</option>)}</select>
        </label>
        <button className="btn btn-primary" disabled={busy || !ephReady} onClick={run}>{busy ? t("common.loading") : t("lab.dates.run")}</button>
      </div>
      <p className="small muted">{t("lab.dates.rules")}</p>
      {top && top.length === 0 && <p className="muted">{t("lab.dates.none")}</p>}
      {top && top.length > 0 && (
        <ol className="windows">
          {top.map((c) => {
            const s = sites.find((x) => x.id === c.siteId)!;
            const { pros, cons } = explain(c, missionDays);
            return (
              <li key={`${c.siteId}${c.start}`} className="window">
                <div className="window-head">
                  <div><strong>{siteText(s, lang).short}</strong> <span className="muted">{fmt.dateTime(c.start)}</span></div>
                  <div className="row"><span className="score">{fmt.num(c.score, 1)}</span>
                    <button className="btn btn-ghost btn-small" onClick={() => onOpen(c.siteId, c.start, missionDays * 24)}>{t("lab.open")}</button></div>
                </div>
                <div className="small muted">{t("lab.dates.summary", { sun: fmt.pct(c.sunPct), earth: fmt.pct(c.earthPct), slip: fmt.num(c.slipDays, 0) })}</div>
                {lang === "fr" && <div className="small faint">{pros.join(" · ")}{cons.length ? ` · ${cons.join(" · ")}` : ""}</div>}
              </li>
            );
          })}
        </ol>
      )}

      {cal && (
        <div className="calendar">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h4>{t("lab.cal.title")}</h4>
            <label className="field">{t("lab.zones.profile")}
              <select value={calProfile} onChange={(e) => setCalProfile(e.target.value)}>
                {PROFILES.filter((p) => p.id !== "custom").map((p) => <option key={p.id} value={p.id}>{t(`profile.${p.id}` as MessageKey)}</option>)}
              </select>
            </label>
          </div>
          <div className="cal-grid" style={{ gridTemplateColumns: `150px repeat(${cal.month_starts.length}, 1fr)` }} role="table" aria-label={t("lab.cal.title")}>
            <div />
            {cal.month_starts.map((m) => <div key={m} className="cal-head">{new Date(m).toLocaleDateString(lang, { month: "short", year: "2-digit", timeZone: "UTC" })}</div>)}
            {cal.sites.map((row) => {
              const s = sites.find((x) => x.id === row.id);
              if (!s) return null;
              return [
                <div key={row.id} className="cal-site">{siteText(s, lang).short}</div>,
                ...row.cells.map((c, i) => {
                  const g = c.grades[calProfile] ?? 0;
                  return <div key={i} className="cal-cell" title={`${fmt.num(g, 0)}/100`} style={{ background: `rgba(155, 240, 216, ${Math.max(0.04, ((g - 25) / 75) ** 2).toFixed(3)})` }}>{fmt.num(g, 0)}</div>;
                }),
              ];
            })}
          </div>
          <p className="small faint">{t("lab.cal.note")}</p>
        </div>
      )}
    </div>
  );
}
