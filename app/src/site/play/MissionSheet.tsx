/**
 * One-page mission sheet, shown only when printing (the browser's "Save as PDF" makes the PDF).
 * Same figures as the Play page, laid out for an A4 page.
 */
import type { RefObject } from "react";
import type { Fragility, Metrics, Sample } from "../../astro/analysis";
import type { HorizonMask } from "../../astro/horizon";
import type { SiteRecord } from "../../data";
import { useI18n } from "../i18n";
import { siteText } from "../i18n/sites";
import { Logo } from "../ui/Logo";
import { SkyChart } from "../viz/SkyChart";
import { TimelineChart } from "../viz/TimelineChart";
import type { Verdict } from "./verdict";

interface Props {
  site: SiteRecord; source: string; start: number; hours: number; samples: Sample[]; mask: HorizonMask;
  m: Metrics; frag: Fragility | null; verdict: Verdict | null;
  relay: { linkPct: number; longestNoLinkH: number; passesPerDay: number } | null; relayWindows: { start: number; end: number }[] | null;
  link: string;
  centerAz: number;
  /** Rendered off-screen for the PDF capture. */
  capture?: boolean;
  sheetRef?: RefObject<HTMLElement>;
}

export function MissionSheet({ capture = false, sheetRef, centerAz, site, source, start, hours, samples, mask, m, frag, verdict, relay, relayWindows, link }: Props) {
  const { t, fmt, lang } = useI18n();
  const x = siteText(site, lang, source);
  const row = (label: string, value: string, note?: string) => (
    <div className="sheet-stat"><div className="stat-label">{label}</div><div className="sheet-value">{value}</div>{note && <div className="sheet-note">{note}</div>}</div>
  );
  return (
    <section ref={sheetRef} className={capture ? "mission-sheet capture" : "mission-sheet"} aria-hidden="true">
      <header className="sheet-head">
        <div className="brand"><Logo size={22} />{t("brand")}</div>
        <div className="sheet-kicker">{t("sheet.title")}</div>
      </header>
      <h1>{x.name}</h1>
      <p className="sheet-meta">
        {fmt.num(Math.abs(site.lat), 3)}°{site.lat < 0 ? "S" : "N"}, {fmt.num(Math.abs(site.lon), 3)}°{site.lon < 0 ? "W" : "E"}
        {" · "}{t("sheet.period", { start: fmt.dateTime(start), d: fmt.hours(hours) })}
      </p>
      <p className="sheet-context">{x.context}</p>
      <div className="sheet-stats">
        {row(t("play.stat.sun"), fmt.pct(m.sunPct), m.longestNightH > 0 ? t("play.stat.night", { h: fmt.hours(m.longestNightH) }) : t("play.stat.noNight"))}
        {row(t("play.stat.earth"), fmt.pct(m.earthPct), m.longestNoEarthH > 0 ? t("play.stat.outage", { h: fmt.hours(m.longestNoEarthH) }) : t("play.stat.noOutage"))}
        {row(t("play.stat.relay"), relay ? fmt.pct(relay.linkPct) : "-", relay ? t("sheet.relayNote", { h: fmt.hours(relay.longestNoLinkH) }) : t("play.relay.na"))}
        {verdict && row(t("play.stat.verdict"), verdict.ok ? t("play.ok") : t("play.notOk"), t(verdict.key, { after: fmt.hours(verdict.vars.afterH ?? 0) }))}
      </div>
      <h2>{t("play.tab.sky")}</h2>
      <SkyChart samples={samples} cursor={0} mask={mask} centerAz={centerAz} compact />
      <h2>{t("play.tab.timeline")}</h2>
      <TimelineChart samples={samples} cursor={-1} relayWindows={relayWindows} uncertain={frag?.windows} compact />
      {frag && (
        <p className="sheet-reliability">
          <strong>{t(frag.level === "robuste" ? "rel.robust" : frag.level === "fragile" ? "rel.fragile" : "rel.confirm")}</strong>{" "}
          {t(frag.level === "robuste" ? "rel.robust.why" : "rel.grey.why", { lo: fmt.pct(Math.min(frag.sunRange[0], frag.earthRange[0])), hi: fmt.pct(Math.max(frag.sunRange[1], frag.earthRange[1])) })}
        </p>
      )}
      <footer className="sheet-foot">
        <span>{t("sheet.foot")}</span>
        <span className="sheet-link">{link}</span>
      </footer>
    </section>
  );
}
