import { artemisRegionAt, distanceToArtemisKm, type ArtemisRegionSet } from "../../astro/regions";
import type { SiteRecord } from "../../data";
import { writeShareState } from "../../share";
import { useI18n } from "../i18n";
import { siteText } from "../i18n/sites";
import { navigate } from "../router";

export interface DivinerSite { temp_avg_k: number; temp_max_k: number; ice_depth_cm: number | null }

/** Site details and the way into Play. */
export function SiteCard({ site, artemis, diviner }: { site: SiteRecord; artemis: ArtemisRegionSet | null; diviner?: DivinerSite }) {
  const { t, fmt, lang } = useI18n();
  const x = siteText(site, lang);
  const inRegion = artemisRegionAt(artemis, site.lat, site.lon);
  const near = !inRegion && site.lat < -80 ? distanceToArtemisKm(artemis, site.lat, site.lon) : null;
  const play = () => navigate("play", site.category === "custom" ? writeShareState({ lat: site.lat, lon: site.lon }) : writeShareState({ siteId: site.id }));
  return (
    <article className="site-card">
      <div className="eyebrow">{site.category === "candidat" ? t("map.legend.candidate") : site.category === "custom" ? t("atlas.point") : t("map.legend.reference")}</div>
      <h3>{x.name}</h3>
      <p className="muted">{x.context}</p>
      <dl className="facts">
        <dt>{t("play.fact.coords")}</dt>
        <dd>{fmt.num(Math.abs(site.lat), 3)}°{site.lat < 0 ? "S" : "N"}, {fmt.num(Math.abs(site.lon), 3)}°{site.lon < 0 ? "W" : "E"}</dd>
        <dt>{t("atlas.region")}</dt><dd>{x.region}</dd>
        {site.elevation_m != null && <><dt>{t("play.fact.altitude")}</dt><dd>{fmt.num(site.elevation_m, 0)} m</dd></>}
        {site.psr && <><dt>{t("play.fact.psr")}</dt><dd>{fmt.num(site.psr.nearest_psr_km, 1)} km</dd></>}
        {diviner && (
          <>
            <dt>{t("atlas.temp")}</dt>
            <dd>{t("atlas.tempValue", { avg: fmt.num(diviner.temp_avg_k - 273.15, 0), max: fmt.num(diviner.temp_max_k - 273.15, 0) })}</dd>
          </>
        )}
        {(inRegion || near) && (
          <>
            <dt>{t("map.legend.artemis")}</dt>
            <dd>{inRegion ?? t("atlas.artemisNear", { name: near!.name, km: fmt.num(near!.km, 1) })}</dd>
          </>
        )}
      </dl>
      <button className="btn btn-primary" onClick={play}>{site.category === "custom" ? t("atlas.playPoint") : t("atlas.playSite")}</button>
    </article>
  );
}
