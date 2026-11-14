import type { HorizonMask } from "../astro/horizon";
import { distanceToArtemisKm, type ArtemisRegionSet } from "../astro/regions";
import type { SiteRecord } from "../data";
import { fmtDeg, fmtLatLon, fmtNum } from "../format";

export function SiteDetails({ site, mask, artemis }: { site: SiteRecord; mask: HorizonMask; artemis?: ArtemisRegionSet | null }) {
  const t = site.terrain;
  const a3 = distanceToArtemisKm(artemis ?? null, site.lat, site.lon);
  return (
    <div className="details">
      <p className="ctx">{site.context}</p>
      <dl>
        <dt>Coordonnées</dt><dd>{fmtLatLon(site.lat, site.lon)}</dd>
        <dt>Distance au pôle</dt><dd>{fmtNum(site.dist_to_pole_km)} km</dd>
        <dt>Altitude</dt><dd>{site.elevation_m != null ? `${fmtNum(site.elevation_m)} m` : "hors MNT polaire"}</dd>
        {site.custom_info?.status === "tiles" && <>
          <dt>Relief au site</dt>
          <dd>{fmtNum(site.custom_info.site_res_m ?? 0)} m/px{site.custom_info.site_res_m !== 20 && " (20 m indisponible ici)"}</dd>
          <dt>Pente : locale / moy. 100 m</dt>
          <dd>{fmtDeg(site.custom_info.slope_local_deg ?? NaN)} / {fmtDeg(site.custom_info.slope_mean_100m_deg ?? NaN)}</dd>
          <dt>Pente max (rayon 100 m)</dt>
          <dd>{fmtDeg(site.custom_info.slope_max_100m_deg ?? NaN)}</dd>
          <dt>Calcul</dt>
          <dd>{site.custom_info.tiles} tuiles · {fmtNum(site.custom_info.megabytes ?? 0, 1)} Mo · {fmtNum((site.custom_info.ms ?? 0) / 1000, 1)} s</dd>
        </>}
        {site.custom_info?.status === "preview" && <>
          <dt>Relief</dt><dd>MNT réduit 1,2 km (tuiles indisponibles) : horizon approximatif</dd>
        </>}
        {t?.hires && <>
          <dt>Pente 20 m : locale / moy. 100 m</dt>
          <dd>{fmtDeg(t.hires.slope_deg_local_40m)} / {fmtDeg(t.hires.slope_deg_mean_100m)}</dd>
          <dt>Rayon 500 m : pente max / &gt; 10°</dt>
          <dd>{fmtDeg(t.hires.slope_deg_max_500m)} / {fmtNum(t.hires.pct_area_slope_gt_10deg_500m, 1)} %</dd>
        </>}
        {t && <>
          <dt>Pente moy. 1 km (120 m)</dt>
          <dd>{fmtDeg(t.slope_deg_mean_1km)}</dd>
          <dt>Relief à 5 km (120 m)</dt>
          <dd>{fmtNum(t.relief_5km.min_m)} à {fmtNum(t.relief_5km.max_m)} m</dd>
        </>}
        {site.psr && <>
          <dt>Ombre permanente la plus proche</dt>
          <dd>{fmtNum(site.psr.nearest_psr_km, 1)} km ({fmtLatLon(site.psr.nearest_psr_lat, site.psr.nearest_psr_lon)})</dd>
        </>}
        {a3 && <>
          <dt>Région Artemis III</dt>
          <dd>{a3.km === 0 ? <b>{a3.name}</b>
            : a3.km > 500 ? <>loin des régions candidates (pôle Sud)</>
            : <>hors des régions — la plus proche : {a3.name} à {fmtNum(a3.km, 1)} km</>}
            <span className="muted"> (contours de la liste NASA 2022)</span>
            {a3.km > 0 && a3.km <= 500 && (
              <span className="muted" style={{ display: "block" }}>
                La liste NASA d'octobre 2024 ajoute Mons Mouton, Mons Mouton Plateau, Peak near Cabeus B et
                Slater Plain, dont les contours ne sont pas publiés.
              </span>
            )}</dd>
        </>}
        <dt>Horizon le plus haut</dt>
        <dd>{fmtDeg(Math.max(...mask.el), 2)}</dd>
        <dt>Source horizon</dt><dd>{site.horizon_source && site.category !== "custom" ? site.horizon_source : mask.source}</dd>
      </dl>
      {!!site.obstacles?.length && (
        <>
          <h4>Obstacles principaux</h4>
          <ul className="obst">
            {site.obstacles.slice(0, 3).map((o, i) => (
              <li key={i}>
                Az. {fmtNum(o.az_from_deg)}–{fmtNum(o.az_to_deg)}° : jusqu'à <b>{fmtDeg(o.peak_elev_deg, 1)}</b> à{" "}
                {fmtNum(o.peak_dist_km, 1)} km
                {o.sun_blocked_pct_time > 0.5 && <> · cache le Soleil {fmtNum(o.sun_blocked_pct_time, 1)} % du temps</>}
                {o.earth_blocked_pct_time > 0.5 && <> · cache la Terre {fmtNum(o.earth_blocked_pct_time, 1)} % du temps</>}
              </li>
            ))}
          </ul>
        </>
      )}
      {site.refs?.length ? (
        <p className="refs">
          Sources : {site.refs.map((r, i) => (
            <a key={r} href={r} target="_blank" rel="noreferrer">[{i + 1}]</a>
          ))}
        </p>
      ) : null}
    </div>
  );
}
