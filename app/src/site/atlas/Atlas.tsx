/**
 * Atlas: an immersive, full-screen map of the south pole on the LROC photo. The title floats top
 * left, the selected site's card floats on the right, quick chips jump between polar sites.
 * Below the map: typed coordinates and every other landing site.
 */
import { useEffect, useMemo, useState } from "react";
import { latLonToXY } from "../../astro/horizon";
import type { SiteRecord } from "../../data";
import { writeShareState } from "../../share";
import { makeCustomSite, useData } from "../data/store";
import { useI18n } from "../i18n";
import { siteText } from "../i18n/sites";
import { navigate } from "../router";
import { PolarMap } from "../viz/PolarMap";
import { parseCoords } from "./coords";
import { SiteCard, type DivinerSite } from "./SiteCard";

const POLAR_LIMIT = -75; // the LROC basemap and the relief stop at 75°S

export function Atlas() {
  const { t, lang } = useI18n();
  const { sites, artemis, dem } = useData();
  const [selected, setSelected] = useState<SiteRecord | null>(null);
  const [diviner, setDiviner] = useState<Record<string, DivinerSite>>({});
  const [typed, setTyped] = useState({ lat: "-85.5", lon: "15" });
  const [typedError, setTypedError] = useState(false);
  const [wide, setWide] = useState(() => window.innerWidth >= 900);
  useEffect(() => { const f = () => setWide(window.innerWidth >= 900); window.addEventListener("resize", f); return () => window.removeEventListener("resize", f); }, []);
  useEffect(() => { fetch("data/sites/diviner.json").then((r) => r.json()).then((j) => setDiviner(j.sites ?? {})).catch(() => {}); }, []);
  useEffect(() => { if (!selected && sites.length) setSelected(sites.find((s) => s.id === "connecting-ridge") ?? null); }, [sites, selected]);

  const polar = useMemo(() => sites.filter((s) => s.lat <= POLAR_LIMIT), [sites]);
  const others = useMemo(() => sites.filter((s) => s.lat > POLAR_LIMIT), [sites]);
  const onMap = selected?.category === "custom" && selected.lat <= POLAR_LIMIT ? [...polar, selected] : polar;
  const focus = useMemo(() => {
    if (!selected || selected.lat > POLAR_LIMIT) return null;
    const [x, y] = latLonToXY(selected.lat, selected.lon);
    return { x, y, dx: wide ? 0.16 : 0 }; // keep the point clear of the floating card
  }, [selected, wide]);

  const choose = (s: SiteRecord) => {
    setSelected(s);
    if (s.lat > POLAR_LIMIT) document.getElementById("atlas-card")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };
  const card = selected && <SiteCard site={selected} artemis={artemis} diviner={diviner[selected.id]} />;

  return (
    <div className="atlas-page">
      <section className="atlas-hero" aria-label={t("map.aria")}>
        <PolarMap fill sites={onMap} selectedId={selected?.id} artemis={artemis} focus={focus} labelOf={(s) => siteText(s, lang).short}
          onSelectSite={(id) => { const s = onMap.find((x) => x.id === id); if (s) setSelected(s); }}
          onPickPoint={(lat, lon) => setSelected(makeCustomSite(lat, lon, dem))} />
        <div className="atlas-shade" aria-hidden="true" />
        <div className="atlas-title">
          <div className="eyebrow">{t("atlas.eyebrow")}</div>
          <h1>{t("atlas.title")}</h1>
          <p>{t("atlas.lead")}</p>
        </div>
        {wide && <div className="atlas-panel" id="atlas-card">{card}</div>}
        <div className="atlas-chips" role="group" aria-label={t("atlas.jump")}>
          {polar.map((s) => (
            <button key={s.id} className={selected?.id === s.id ? "chip on" : "chip"} onClick={() => setSelected(s)}>
              <span className={s.category === "candidat" ? "lg lg-candidate" : "lg lg-reference"} />{siteText(s, lang).short}
            </button>
          ))}
        </div>
      </section>

      <div className="container atlas-below">
        {!wide && <div id="atlas-card" className="atlas-card-mobile">{card}</div>}
        <div className="legend small">
          <span><span className="lg lg-candidate" />{t("map.legend.candidate")}</span>
          <span><span className="lg lg-reference" />{t("map.legend.reference")}</span>
          <span><span className="lg lg-artemis" />{t("map.legend.artemis")}</span>
          <span className="faint">{t("atlas.hint")}</span>
        </div>

        <div className="atlas-grid">
          <form className="coords-form" onSubmit={(e) => {
            e.preventDefault();
            const c = parseCoords(typed.lat, typed.lon);
            setTypedError(!c);
            if (c) choose(makeCustomSite(c.lat, c.lon, dem));
          }}>
            <h3>{t("atlas.coords")}</h3>
            <p className={typedError ? "small" : "small faint"} role={typedError ? "alert" : undefined}>{typedError ? t("atlas.coordsError") : t("atlas.coordsHint")}</p>
            <div className="row">
              <label className="field">{t("atlas.lat")}<input value={typed.lat} inputMode="decimal" onChange={(e) => setTyped({ ...typed, lat: e.target.value })} /></label>
              <label className="field">{t("atlas.lon")}<input value={typed.lon} inputMode="decimal" onChange={(e) => setTyped({ ...typed, lon: e.target.value })} /></label>
            </div>
            <button className="btn btn-primary" type="submit">{t("atlas.go")}</button>
          </form>

          <div className="others">
            <h3>{t("atlas.others")}</h3>
            <p className="small faint">{t("atlas.othersNote")}</p>
            <div className="other-cards">
              {others.map((s) => {
                const x = siteText(s, lang);
                return (
                  <article key={s.id} className={selected?.id === s.id ? "other-card on" : "other-card"}>
                    <button className="other-main" onClick={() => choose(s)}>
                      <span className="other-name">{x.short}</span>
                      <span className="faint small">{x.region}</span>
                    </button>
                    <button className="btn btn-ghost btn-small" onClick={() => navigate("play", writeShareState({ siteId: s.id }))}>{t("nav.play")}</button>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
