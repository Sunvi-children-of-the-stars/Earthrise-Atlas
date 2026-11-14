/** Mission Lab: the expert tools, in tabs. Simple settings first, advanced ones folded. Loaded on demand. */
import { useEffect, useMemo, useState } from "react";
import { simulate } from "../../astro/analysis";
import type { SiteRecord } from "../../data";
import { writeShareState } from "../../share";
import { makeCustomSite, useData, useMask } from "../data/store";
import { useI18n, type MessageKey } from "../i18n";
import { siteText } from "../i18n/sites";
import { navigate } from "../router";
import { initialPlayState, playHref, stepFor, type PlayState } from "../play/state";
import { Tabs } from "../ui/Tabs";
import { CompareTab } from "./CompareTab";
import { DatesTab } from "./DatesTab";
import { PowerTab } from "./PowerTab";
import { ZonesTab } from "./ZonesTab";

const DURATIONS: { hours: number; key: MessageKey }[] = [
  { hours: 72, key: "play.dur.3d" }, { hours: 168, key: "play.dur.7d" }, { hours: 708.7, key: "play.dur.lunar" }, { hours: 2160, key: "lab.dur.3m" },
];
const toInput = (ms: number) => new Date(ms).toISOString().slice(0, 16);

export interface LabScenario { site: SiteRecord; st: PlayState }

export default function Lab() {
  const { t, lang } = useI18n();
  const { sites, dem, ephReady } = useData();
  const [tab, setTab] = useState("zones");
  const [st, setSt] = useState<PlayState | null>(null);
  const [wide, setWide] = useState(() => window.innerWidth >= 900);
  useEffect(() => { const f = () => setWide(window.innerWidth >= 900); window.addEventListener("resize", f); return () => window.removeEventListener("resize", f); }, []);
  useEffect(() => { if (sites.length && !st) setSt(initialPlayState(window.location.hash, sites.map((s) => s.id), Date.now())); }, [sites, st]);
  useEffect(() => { if (st) window.history.replaceState(null, "", playHref(window.location.pathname, st)); }, [st]);

  const site = useMemo(() => (st ? (st.custom ? makeCustomSite(st.custom.lat, st.custom.lon, dem) : sites.find((s) => s.id === st.siteId) ?? null) : null), [st, sites, dem]);
  const { mask } = useMask(site);
  const samples = useMemo(() => (site && mask && st && ephReady ? simulate(site, mask, st.start, st.hours, stepFor(st.hours)) : []),
    [site, mask, st?.start, st?.hours, ephReady]); // eslint-disable-line react-hooks/exhaustive-deps

  const head = (
    <div className="page-head">
      <div className="eyebrow">{t("lab.eyebrow")}</div>
      <h1>{t("lab.title")}</h1>
      <p>{t("lab.lead")}</p>
    </div>
  );
  if (!wide) {
    return (
      <section className="page container">{head}
        <div className="panel center"><p>{t("lab.small")}</p>
          <button className="btn btn-primary" onClick={() => navigate("play", window.location.hash)}>{t("nav.play")}</button></div>
      </section>
    );
  }
  if (!st || !site) return <section className="page container">{head}<p className="center muted">{t("common.loading")}</p></section>;
  const set = (p: Partial<PlayState>) => setSt({ ...st, ...p, cursor: 0 });

  return (
    <section className="page container lab">
      {head}
      <div className="panel play-controls">
        <label className="field grow">{t("play.site")}
          <select value={st.custom ? "custom" : st.siteId} onChange={(e) => set({ siteId: e.target.value, custom: undefined })}>
            {st.custom && <option value="custom">{siteText(site, lang).short}</option>}
            {sites.map((s) => <option key={s.id} value={s.id}>{siteText(s, lang).short}</option>)}
          </select>
        </label>
        <label className="field">{t("play.start")}
          <input type="datetime-local" value={toInput(st.start)} onChange={(e) => { const v = Date.parse(e.target.value + ":00Z"); if (!Number.isNaN(v)) set({ start: v }); }} />
        </label>
        <label className="field">{t("play.duration")}
          <select value={st.hours} onChange={(e) => set({ hours: Number(e.target.value) })}>
            {DURATIONS.map((d) => <option key={d.hours} value={d.hours}>{t(d.key)}</option>)}
          </select>
        </label>
      </div>
      <Tabs idPrefix="lab" active={tab} onChange={setTab} tabs={[
        { id: "zones", label: t("lab.tab.zones") }, { id: "dates", label: t("lab.tab.dates") },
        { id: "power", label: t("lab.tab.power") }, { id: "compare", label: t("lab.tab.compare") },
      ]}>
        {tab === "zones" && <ZonesTab start={st.start} hours={st.hours} onOpen={(lat, lon) => navigate("play", writeShareState({ lat, lon, start: st.start, hours: st.hours }))} />}
        {tab === "dates" && <DatesTab defaultFrom={st.start} onOpen={(siteId, start, hours) => setSt({ siteId, start, hours, cursor: 0 })} />}
        {tab === "power" && <PowerTab site={site} mask={mask} samples={samples} start={st.start} hours={st.hours} />}
        {tab === "compare" && <CompareTab current={st} />}
      </Tabs>
    </section>
  );
}
