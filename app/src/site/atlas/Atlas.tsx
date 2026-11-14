/** Atlas: the south pole on the LROC photo, the landing sites, and every other landing site in a list. */
import { useEffect, useMemo, useState } from "react";
import type { SiteRecord } from "../../data";
import { makeCustomSite, useData } from "../data/store";
import { useI18n } from "../i18n";
import { siteText } from "../i18n/sites";
import { PolarMap } from "../viz/PolarMap";
import { SiteCard, type DivinerSite } from "./SiteCard";

const POLAR_LIMIT = -75; // the LROC basemap and the relief stop at 75°S

export function Atlas() {
  const { t, lang } = useI18n();
  const { sites, artemis, dem } = useData();
  const [selected, setSelected] = useState<SiteRecord | null>(null);
  const [diviner, setDiviner] = useState<Record<string, DivinerSite>>({});
  useEffect(() => { fetch("data/sites/diviner.json").then((r) => r.json()).then((j) => setDiviner(j.sites ?? {})).catch(() => {}); }, []);
  useEffect(() => { if (!selected && sites.length) setSelected(sites.find((s) => s.id === "connecting-ridge") ?? null); }, [sites, selected]);

  const polar = useMemo(() => sites.filter((s) => s.lat <= POLAR_LIMIT), [sites]);
  const others = useMemo(() => sites.filter((s) => s.lat > POLAR_LIMIT), [sites]);
  const onMap = selected?.category === "custom" ? [...polar, selected] : polar;

  return (
    <section className="page container">
      <div className="page-head">
        <div className="eyebrow">{t("atlas.eyebrow")}</div>
        <h1>{t("atlas.title")}</h1>
        <p>{t("atlas.lead")}</p>
      </div>
      <div className="atlas">
        <div className="atlas-map">
          <PolarMap sites={onMap} selectedId={selected?.id} artemis={artemis} labelOf={(s) => siteText(s, lang).short}
            onSelectSite={(id) => setSelected(onMap.find((s) => s.id === id) ?? null)}
            onPickPoint={(lat, lon) => setSelected(makeCustomSite(lat, lon, dem))} />
          <div className="legend small">
            <span><span className="lg lg-candidate" />{t("map.legend.candidate")}</span>
            <span><span className="lg lg-reference" />{t("map.legend.reference")}</span>
            <span><span className="lg lg-artemis" />{t("map.legend.artemis")}</span>
            <span className="faint">{t("atlas.hint")}</span>
          </div>
        </div>
        <aside className="atlas-side">
          {selected && <SiteCard site={selected} artemis={artemis} diviner={diviner[selected.id]} />}
          <div className="others">
            <h4>{t("atlas.others")}</h4>
            <p className="small faint">{t("atlas.othersNote")}</p>
            <ul>
              {others.map((s) => (
                <li key={s.id}>
                  <button className={selected?.id === s.id ? "other on" : "other"} onClick={() => setSelected(s)}>
                    <span>{siteText(s, lang).short}</span>
                    <span className="faint small">{siteText(s, lang).region}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </section>
  );
}
