/** Method: where the data comes from, how the results are checked, and who built the atlas. */
import { useState } from "react";
import { useI18n, type MessageKey } from "../i18n";
import { Tabs } from "../ui/Tabs";

const REPO = "https://github.com/Topelus/Lunar-landing-site-visualization-tool";
const DOC = (f: string) => `${REPO}/blob/main/docs/${f}`;

/** Published validation results (docs/decision_ephemerides.md, docs/validation_lola.md, app tests). */
const VALIDATION = { ephemerisMaxDeg: 0.003, seriesMaxDeg: 0.19, psrIoU: [0.8, 0.93], sunRms: [2.1, 2.5], curvRms: 3.1, flatRms: 11 };

const SOURCES: { key: string; url: string }[] = [
  { key: "lola", url: "https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/" },
  { key: "horizons", url: "https://ssd.jpl.nasa.gov/horizons/" },
  { key: "lroc", url: "https://pds.lroc.asu.edu/" },
  { key: "diviner", url: "https://pds-geosciences.wustl.edu/lro/urn-nasa-pds-lro_diviner_derived1/data_derived_prp/" },
  { key: "lro", url: "https://ssd.jpl.nasa.gov/horizons/" },
  { key: "relays", url: DOC("phase_A.md") },
];

const TEAM = ["IDOHOU Cyrus", "Elge TOPANOU", "Ezékias AGLOSSI", "GBAGUIDI Ursus", "Marguerite ASSOU"];

export function Method() {
  const { t, fmt } = useI18n();
  const [tab, setTab] = useState("data");
  const k = (s: string) => s as MessageKey;
  return (
    <section className="page container">
      <div className="page-head">
        <div className="eyebrow">{t("method.eyebrow")}</div>
        <h1>{t("method.title")}</h1>
        <p>{t("method.lead")}</p>
      </div>
      <Tabs idPrefix="method" active={tab} onChange={setTab}
        tabs={[{ id: "data", label: t("method.tab.data") }, { id: "validation", label: t("method.tab.validation") }, { id: "team", label: t("method.tab.team") }]}>
        {tab === "data" && (
          <div className="cards">
            {SOURCES.map((s) => (
              <article key={s.key} className="card">
                <h3>{t(k(`src.${s.key}.name`))}</h3>
                <p className="muted">{t(k(`src.${s.key}.what`))}</p>
                <p className="small faint">{t(k(`src.${s.key}.res`))}</p>
                <a href={s.url} target="_blank" rel="noreferrer" className="small">{t("method.source")}</a>
              </article>
            ))}
          </div>
        )}
        {tab === "validation" && (
          <div className="cards">
            <article className="card">
              <h3>{t("val.eph.title")}</h3>
              <p className="muted">{t("val.eph.text", { table: fmt.num(VALIDATION.ephemerisMaxDeg, 3), series: fmt.num(VALIDATION.seriesMaxDeg, 2) })}</p>
              <a className="small" href={DOC("decision_ephemerides.md")} target="_blank" rel="noreferrer">{t("method.details")}</a>
            </article>
            <article className="card">
              <h3>{t("val.psr.title")}</h3>
              <p className="muted">{t("val.psr.text", { lo: fmt.num(VALIDATION.psrIoU[0], 2), hi: fmt.num(VALIDATION.psrIoU[1], 2), rlo: fmt.num(VALIDATION.sunRms[0], 1), rhi: fmt.num(VALIDATION.sunRms[1], 1) })}</p>
              <a className="small" href={DOC("validation_lola.md")} target="_blank" rel="noreferrer">{t("method.details")}</a>
            </article>
            <article className="card">
              <h3>{t("val.curv.title")}</h3>
              <p className="muted">{t("val.curv.text", { with: fmt.num(VALIDATION.curvRms, 1), without: fmt.num(VALIDATION.flatRms, 0) })}</p>
              <a className="small" href={DOC("validation_quickmap.md")} target="_blank" rel="noreferrer">{t("method.details")}</a>
            </article>
            <article className="card">
              <h3>{t("val.limits.title")}</h3>
              <p className="muted">{t("val.limits.text")}</p>
            </article>
          </div>
        )}
        {tab === "team" && (
          <div className="team">
            <p className="muted center">{t("team.lead")}</p>
            <ul className="members">
              {TEAM.map((n) => <li key={n}><span className="member-name">{n}</span><span className="faint small">{t("team.country")}</span></li>)}
            </ul>
            <p className="center"><a className="btn btn-ghost" href={REPO} target="_blank" rel="noreferrer">{t("team.code")}</a></p>
          </div>
        )}
      </Tabs>
    </section>
  );
}
