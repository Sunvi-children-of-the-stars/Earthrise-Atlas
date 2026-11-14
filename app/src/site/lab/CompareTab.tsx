/** Compare: saved scenarios side by side, best value of each column highlighted. */
import { useEffect, useMemo, useState } from "react";
import { fragility, metrics, simulate, type Metrics } from "../../astro/analysis";
import { loadMask, type HorizonMask } from "../../astro/horizon";
import { relayAnalysis } from "../../astro/relay";
import { writeShareState } from "../../share";
import { makeCustomSite, useData } from "../data/store";
import { useI18n, type MessageKey } from "../i18n";
import { siteText } from "../i18n/sites";
import type { PlayState } from "../play/state";
import { stepFor } from "../play/state";
import { navigate } from "../router";
import { browserStorage, loadScenarios, saveScenarios, scenarioKey, type Scenario } from "./scenarios";

type Col = { key: MessageKey; get: (m: Metrics, link: number | null) => number | null; fmt: "pct" | "h"; better: "max" | "min" };
const COLS: Col[] = [
  { key: "play.stat.sun", get: (m) => m.sunPct, fmt: "pct", better: "max" },
  { key: "play.delay.night", get: (m) => m.longestNightH, fmt: "h", better: "min" },
  { key: "play.stat.earth", get: (m) => m.earthPct, fmt: "pct", better: "max" },
  { key: "lab.col.outage", get: (m) => m.longestNoEarthH, fmt: "h", better: "min" },
  { key: "play.stat.relay", get: (_m, l) => l, fmt: "pct", better: "max" },
];

export function CompareTab({ current }: { current: PlayState }) {
  const { t, fmt, lang } = useI18n();
  const { sites, dem, lro, ephReady } = useData();
  const [list, setList] = useState<Scenario[]>(() => loadScenarios(browserStorage()));
  const [masks, setMasks] = useState<Record<string, HorizonMask>>({});
  useEffect(() => saveScenarios(list, browserStorage()), [list]);
  useEffect(() => {
    for (const s of list) if (!s.custom && !masks[s.siteId]) loadMask(s.siteId).then((m) => setMasks((x) => ({ ...x, [s.siteId]: m }))).catch(() => {});
  }, [list, masks]);

  const add = () => {
    const base = { siteId: current.siteId, custom: current.custom, start: current.start, hours: current.hours };
    const key = scenarioKey(base);
    if (!list.some((s) => s.key === key)) setList([...list, { ...base, key }]);
  };

  const rows = useMemo(() => list.flatMap((sc) => {
    if (sc.custom) return []; // custom horizons are computed in Play; compare curated sites here
    const site = sites.find((s) => s.id === sc.siteId), mask = masks[sc.siteId];
    if (!site || !mask || !ephReady) return [];
    const ss = simulate(site, mask, sc.start, sc.hours, stepFor(sc.hours));
    const rel = lro ? relayAnalysis(site, mask, lro, sc.start, sc.hours) : null;
    return [{ sc, site, m: metrics(ss), f: fragility(ss), link: rel && rel.available ? rel.linkPct : null }];
  }), [list, sites, masks, lro, ephReady]);

  const best = COLS.map((c) => {
    const vals = rows.map((r) => c.get(r.m, r.link)).filter((x): x is number => x !== null);
    return vals.length ? (c.better === "max" ? Math.max(...vals) : Math.min(...vals)) : null;
  });
  const currentSite = current.custom ? makeCustomSite(current.custom.lat, current.custom.lon, dem) : sites.find((s) => s.id === current.siteId);

  return (
    <div className="stack">
      <div className="row lab-row">
        <button className="btn btn-primary" onClick={add} disabled={!!current.custom}>{t("lab.compare.add")}</button>
        <span className="small muted">{currentSite ? `${siteText(currentSite, lang).short}, ${fmt.dateTime(current.start)}` : ""}</span>
        {list.length > 0 && <button className="btn btn-ghost btn-small" onClick={() => setList([])}>{t("lab.compare.clear")}</button>}
      </div>
      {current.custom && <p className="small faint">{t("lab.compare.customNote")}</p>}
      {list.length === 0 ? <p className="muted">{t("lab.compare.empty")}</p> : (
        <table className="table">
          <thead><tr><th>{t("play.site")}</th><th>{t("play.start")}</th>{COLS.map((c) => <th key={c.key}>{t(c.key)}</th>)}<th>{t("lab.col.reliability")}</th><th></th></tr></thead>
          <tbody>{rows.map(({ sc, site, m, f, link }) => (
            <tr key={sc.key}>
              <td>{siteText(site, lang).short}</td>
              <td className="small">{fmt.date(sc.start)}<br /><span className="faint">{fmt.hours(sc.hours)}</span></td>
              {COLS.map((c, i) => {
                const v = c.get(m, link);
                return <td key={c.key} className={v !== null && v === best[i] && rows.length > 1 ? "best" : ""}>{v === null ? "-" : c.fmt === "pct" ? fmt.pct(v) : fmt.hours(v)}</td>;
              })}
              <td>{t(f.level === "robuste" ? "rel.robust" : f.level === "fragile" ? "rel.fragile" : "rel.confirm")}</td>
              <td className="nowrap">
                <button className="btn btn-ghost btn-small" onClick={() => navigate("play", writeShareState({ siteId: sc.siteId, start: sc.start, hours: sc.hours }))}>{t("lab.open")}</button>
                <button className="btn btn-ghost btn-small" aria-label={t("lab.compare.remove")} onClick={() => setList(list.filter((x) => x.key !== sc.key))}>×</button>
              </td>
            </tr>
          ))}</tbody>
        </table>
      )}
    </div>
  );
}
