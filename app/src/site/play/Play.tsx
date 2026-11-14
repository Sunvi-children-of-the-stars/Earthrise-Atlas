/** Play: pick a site and a date, see the sky, the timeline and what it means for a mission. */
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { fragility, metrics, seasonal, simulate, SYNODIC_DAYS } from "../../astro/analysis";
import { relayAnalysis } from "../../astro/relay";
import type { SiteRecord } from "../../data";
import { shiftScan } from "../../optim/delay";
import { shareUrl } from "../../share";
import { makeCustomSite, useData, useMask, type MaskSource } from "../data/store";
import { useI18n, type MessageKey } from "../i18n";
import { siteText } from "../i18n/sites";
import { navigate } from "../router";
import { StatCard } from "../ui/StatCard";
import { DelayNearby } from "./DelayNearby";
import { MissionSheet } from "./MissionSheet";

const Terrain3D = lazy(() => import("./Terrain3D"));
import { Tabs } from "../ui/Tabs";
import { circularMeanDeg } from "../viz/geometry";
import { SkyChart } from "../viz/SkyChart";
import { TimelineChart } from "../viz/TimelineChart";
import { initialPlayState, playHref, playShare, stepFor, type PlayState } from "./state";
import { missionVerdict, relaySummary } from "./verdict";

const DURATIONS: { hours: number; key: MessageKey }[] = [
  { hours: 72, key: "play.dur.3d" }, { hours: 168, key: "play.dur.7d" }, { hours: 708.7, key: "play.dur.lunar" },
];
const SOURCE_KEY: Record<MaskSource, MessageKey> = {
  precomputed: "play.src.precomputed", tiles: "play.src.tiles", preview: "play.src.preview", flat: "play.src.flat", loading: "common.loading",
};

const toInput = (ms: number) => new Date(ms).toISOString().slice(0, 16);
const fromInput = (v: string) => Date.parse(v + ":00Z");

export function Play() {
  const { t, fmt, lang } = useI18n();
  const { sites, dem, lro, ephReady } = useData();
  const [st, setSt] = useState<PlayState | null>(null);
  const [tab, setTab] = useState("sky");
  const [playing, setPlaying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showDelay, setShowDelay] = useState(false);

  useEffect(() => {
    if (sites.length && !st) setSt(initialPlayState(window.location.hash, sites.map((s) => s.id), Date.now()));
  }, [sites, st]);

  const site: SiteRecord | null = useMemo(() => {
    if (!st) return null;
    if (st.custom) return makeCustomSite(st.custom.lat, st.custom.lon, dem);
    return sites.find((s) => s.id === st.siteId) ?? null;
  }, [st, sites, dem]);
  const { mask, source, elevation_m } = useMask(site);

  // Keep the shareable hash in sync
  useEffect(() => {
    if (!st) return;
    window.history.replaceState(null, "", playHref(window.location.pathname, st));
  }, [st]);

  const samples = useMemo(() => (site && mask && ephReady && st ? simulate(site, mask, st.start, st.hours, stepFor(st.hours)) : []),
    [site, mask, ephReady, st?.start, st?.hours]); // eslint-disable-line react-hooks/exhaustive-deps
  const cursor = Math.min(st?.cursor ?? 0, Math.max(0, samples.length - 1));
  const m = useMemo(() => (samples.length ? metrics(samples, cursor) : null), [samples, cursor]);
  const frag = useMemo(() => (samples.length ? fragility(samples, cursor) : null), [samples, cursor]);
  const verdict = useMemo(() => (samples.length ? missionVerdict(samples) : null), [samples]);
  const relay = useMemo(() => (site && mask && lro && st && ephReady ? relayAnalysis(site, mask, lro, st.start, st.hours) : null),
    [site, mask, lro, st?.start, st?.hours, ephReady]); // eslint-disable-line react-hooks/exhaustive-deps
  const rs = relaySummary(relay);
  const months = useMemo(() => (site && mask && st && ephReady && tab === "site" ? seasonal(site, mask, st.start) : []),
    [site, mask, st?.start, ephReady, tab]); // eslint-disable-line react-hooks/exhaustive-deps
  const delay = useMemo(() => (showDelay && site && mask && st && ephReady
    ? shiftScan(site, mask, st.start, st.hours, [0, SYNODIC_DAYS * 24], stepFor(st.hours)) : null),
  [showDelay, site, mask, st?.start, st?.hours, ephReady]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!playing || !samples.length) return;
    const id = setInterval(() => setSt((s) => {
      if (!s) return s;
      const next = s.cursor + Math.max(1, Math.round(samples.length / 300));
      if (next >= samples.length - 1) { setPlaying(false); return { ...s, cursor: samples.length - 1 }; }
      return { ...s, cursor: next };
    }), 50);
    return () => clearInterval(id);
  }, [playing, samples.length]);

  if (!st || !site) return <section className="page container"><div className="page-head"><p>{t("common.loading")}</p></div></section>;
  const set = (p: Partial<PlayState>) => { setSt({ ...st, ...p, cursor: p.cursor ?? 0 }); setShowDelay(false); };
  const text = siteText(site, lang, source);
  const groups: [MessageKey, SiteRecord[]][] = [
    ["play.group.candidates", sites.filter((s) => s.category === "candidat")],
    ["play.group.past", sites.filter((s) => s.category === "reference")],
  ];
  const share = async () => {
    try { await navigator.clipboard.writeText(shareUrl(playShare(st), window.location.href)); setCopied(true); setTimeout(() => setCopied(false), 2500); }
    catch { /* clipboard refused: the URL in the address bar is the link */ }
  };
  // Centre the panorama on the Earth's mean direction: it stays in one piece in the middle of the chart
  const centerAz = samples.length ? circularMeanDeg(samples.map((s) => s.eAz)) : site.lat < 0 ? 180 : 0;
  const now = m?.now;

  return (
    <section className="page container">
      <div className="page-head">
        <div className="eyebrow">{t("play.eyebrow")}</div>
        <h1>{t("play.title")}</h1>
        <p>{t("play.lead")}</p>
      </div>

      <div className="panel play-controls">
        <label className="field grow">{t("play.site")}
          <select value={st.custom ? "custom" : st.siteId} onChange={(e) => set({ siteId: e.target.value, custom: undefined })}>
            {st.custom && <option value="custom">{text.short}</option>}
            {groups.map(([k, list]) => (
              <optgroup key={k} label={t(k)}>{list.map((s) => <option key={s.id} value={s.id}>{siteText(s, lang).short}</option>)}</optgroup>
            ))}
          </select>
        </label>
        <label className="field">{t("play.start")}
          <input type="datetime-local" value={toInput(st.start)} onChange={(e) => { const v = fromInput(e.target.value); if (!Number.isNaN(v)) set({ start: v }); }} />
        </label>
        <label className="field">{t("play.duration")}
          <select value={st.hours} onChange={(e) => set({ hours: Number(e.target.value) })}>
            {DURATIONS.map((d) => <option key={d.hours} value={d.hours}>{t(d.key)}</option>)}
          </select>
        </label>
        <div className="row play-actions">
          <button className="btn btn-ghost btn-small" onClick={() => setShowDelay((v) => !v)} aria-expanded={showDelay}>{t("play.delay")}</button>
          <button className="btn btn-ghost btn-small" onClick={share}>{copied ? t("play.copied") : t("play.share")}</button>
          <button className="btn btn-ghost btn-small" onClick={() => navigate("lab", window.location.hash)}>{t("play.openLab")}</button>
          <button className="btn btn-ghost btn-small" onClick={() => window.print()} disabled={!m}>{t("sheet.print")}</button>
        </div>
      </div>

      <p className="site-context"><strong>{text.name}</strong>. {text.context}</p>

      {!m || !mask ? <p className="muted center">{t("common.loading")}</p> : (
        <>
          <div className="stats">
            <StatCard tone="sun" label={t("play.stat.sun")} value={fmt.pct(m.sunPct)}
              note={m.longestNightH > 0 ? t("play.stat.night", { h: fmt.hours(m.longestNightH) }) : t("play.stat.noNight")} />
            <StatCard tone="earth" label={t("play.stat.earth")} value={fmt.pct(m.earthPct)}
              note={m.longestNoEarthH > 0 ? t("play.stat.outage", { h: fmt.hours(m.longestNoEarthH) }) : t("play.stat.noOutage")} />
            <StatCard label={t("play.stat.relay")} value={rs ? fmt.pct(rs.linkPct) : "-"}
              note={rs ? t("play.stat.relayNote", { h: fmt.hours(rs.longestNoLinkH), n: fmt.num(rs.passesPerDay, 1) }) : t("play.relay.na")} />
            {verdict && (
              <StatCard tone={verdict.ok ? "ok" : "warn"} label={t("play.stat.verdict")} value={verdict.ok ? t("play.ok") : t("play.notOk")}
                note={t(verdict.key, { after: fmt.hours(verdict.vars.afterH ?? 0) })} />
            )}
          </div>

          {showDelay && delay && (
            <div className="panel delay">
              <h3>{t("play.delay.title")}</h3>
              <div className="delay-grid">
                {[["play.stat.sun", delay[0].sunPct, delay[1].sunPct], ["play.stat.earth", delay[0].earthPct, delay[1].earthPct]].map(([k, a, b]) => (
                  <div key={k as string}><div className="stat-label">{t(k as MessageKey)}</div>
                    <div className="delay-vals">{fmt.pct(a as number)} <span className="faint">→</span> <strong>{fmt.pct(b as number)}</strong></div></div>
                ))}
                <div><div className="stat-label">{t("play.delay.night")}</div>
                  <div className="delay-vals">{fmt.hours(delay[0].longestNightH)} <span className="faint">→</span> <strong>{fmt.hours(delay[1].longestNightH)}</strong></div></div>
              </div>
              <p className="muted small">{t("play.delay.note", { date: fmt.date(delay[1].start) })}</p>
              <DelayNearby lat={site.lat} lon={site.lon} start={st.start} hours={st.hours}
                onOpen={(lat, lon, start) => { setSt({ siteId: st.siteId, custom: { lat, lon }, start, hours: st.hours, cursor: 0 }); setShowDelay(false); window.scrollTo(0, 0); }} />
            </div>
          )}

          <Tabs idPrefix="play" active={tab} onChange={setTab}
            tabs={[{ id: "sky", label: t("play.tab.sky") }, { id: "timeline", label: t("play.tab.timeline") }, { id: "3d", label: t("play.tab.3d") }, { id: "site", label: t("play.tab.site") }]}>
            {tab === "sky" && (
              <div className="stack">
                <SkyChart samples={samples} cursor={cursor} mask={mask} centerAz={centerAz} />
                <div className="row player">
                  <button className="btn btn-primary btn-small" onClick={() => { if (cursor >= samples.length - 1) set({ cursor: 0 }); setPlaying((p) => !p); }}>
                    {playing ? t("play.pause") : t("play.play")}
                  </button>
                  <input type="range" min={0} max={samples.length - 1} value={cursor} aria-label={t("tl.cursor")}
                    onChange={(e) => { setPlaying(false); setSt({ ...st, cursor: Number(e.target.value) }); }} />
                  <span className="small muted">{now && fmt.dateTime(now.t)}</span>
                </div>
                <p className="small faint">{t("play.sky.legend")}</p>
              </div>
            )}
            {tab === "timeline" && (
              <div className="stack">
                <TimelineChart samples={samples} cursor={cursor} onCursor={(i) => setSt({ ...st, cursor: i })}
                  relayWindows={rs ? relay!.windows : null} uncertain={frag?.windows} />
                <div className="stats small-stats">
                  <StatCard tone="sun" label={t("play.next.sun")} value={m.sunChangeH === null ? "-" : fmt.hours(m.sunChangeH)}
                    note={m.sunChangeH === null ? t("play.next.never") : m.sunIsUp ? t("play.next.sets") : t("play.next.rises")} />
                  <StatCard tone="earth" label={t("play.next.earth")} value={m.earthChangeH === null ? "-" : fmt.hours(m.earthChangeH)}
                    note={m.earthChangeH === null ? t("play.next.never") : m.earthIsUp ? t("play.next.sets") : t("play.next.rises")} />
                </div>
                <p className="small faint">{rs ? t("play.relay.lro") : t("play.relay.na")}</p>
              </div>
            )}
            {tab === "3d" && (
              <Suspense fallback={<p className="muted">{t("common.loading")}</p>}>
                <Terrain3D site={site} samples={samples} cursor={cursor} onCursor={(i) => { setPlaying(false); setSt({ ...st, cursor: i }); }} />
              </Suspense>
            )}
            {tab === "site" && (
              <div className="site-tab">
                <dl className="facts">
                  <dt>{t("play.fact.coords")}</dt><dd>{fmt.num(Math.abs(site.lat), 3)}°{site.lat < 0 ? "S" : "N"}, {fmt.num(Math.abs(site.lon), 3)}°{site.lon < 0 ? "W" : "E"}</dd>
                  <dt>{t("play.fact.altitude")}</dt><dd>{(elevation_m ?? site.elevation_m) != null ? `${fmt.num(elevation_m ?? site.elevation_m!, 0)} m` : "-"}</dd>
                  {site.terrain && <><dt>{t("play.fact.slope")}</dt><dd>{fmt.num(site.terrain.slope_deg_mean_1km, 1)}°</dd></>}
                  {site.psr && <><dt>{t("play.fact.psr")}</dt><dd>{fmt.num(site.psr.nearest_psr_km, 1)} km</dd></>}
                  <dt>{t("play.fact.horizon")}</dt><dd>{t(SOURCE_KEY[source])}</dd>
                </dl>
                {frag && (
                  <div className={`reliability rel-${frag.level === "robuste" ? "ok" : frag.level === "fragile" ? "warn" : "mid"}`}>
                    <strong>{t(frag.level === "robuste" ? "rel.robust" : frag.level === "fragile" ? "rel.fragile" : "rel.confirm")}</strong>
                    <span> {t(frag.level === "robuste" ? "rel.robust.why" : "rel.grey.why", { lo: fmt.pct(Math.min(frag.sunRange[0], frag.earthRange[0])), hi: fmt.pct(Math.max(frag.sunRange[1], frag.earthRange[1])) })}</span>
                  </div>
                )}
                {months.length > 0 && (
                  <div>
                    <h4>{t("play.months")}</h4>
                    <div className="months" role="img" aria-label={t("play.months")}>
                      {months.map((mo) => (
                        <button key={mo.start} className="month" onClick={() => set({ start: mo.start, hours: 708.7 })} title={fmt.date(mo.start)}>
                          <span className="bar sun" style={{ height: `${mo.sunPct}%` }} />
                          <span className="bar earth" style={{ height: `${mo.earthPct}%` }} />
                          <span className="month-label">{new Date(mo.start).toLocaleDateString(lang, { month: "short", timeZone: "UTC" })}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </Tabs>
        </>
      )}
      {m && mask && samples.length > 0 && (
        <MissionSheet centerAz={centerAz} site={site} source={source} start={st.start} hours={st.hours} samples={samples} mask={mask} m={m} frag={frag}
          verdict={verdict} relay={rs} relayWindows={rs ? relay!.windows : null} link={shareUrl(playShare(st), window.location.href)} />
      )}
    </section>
  );
}
