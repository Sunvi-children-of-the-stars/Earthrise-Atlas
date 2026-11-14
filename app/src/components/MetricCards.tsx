import { FAR_KM, GREY_DEG, type Fragility, type Metrics } from "../astro/analysis";
import { fmtDate, fmtDeg, fmtDuration, fmtNum, fmtPct } from "../format";
import { RELAY_MIN_ELEV_DEG, type RelayResult } from "../astro/relay";

const range = (r: [number, number]) => `${Math.round(r[0])}–${Math.round(r[1])} %`;

function nowWarning(margin: number, far: boolean, dist: number) {
  if (far) return <span className="frag-note">⚠ décidé par un relief à {fmtNum(dist)} km : sensible à la courbure</span>;
  if (Math.abs(margin) < GREY_DEG) return <span className="frag-note">⚠ à {fmtDeg(Math.abs(margin), 1)} de l'horizon : incertain</span>;
  return null;
}

export function MetricCards({ m, f, relay, relayName }: { m: Metrics; f: Fragility; relay?: RelayResult | null; relayName?: string }) {
  const n = m.now;
  const reasons: string[] = [];
  if (f.sunRange[1] - f.sunRange[0] > 5) reasons.push(`ensoleillement entre ${range(f.sunRange)} si l'horizon varie de ±${fmtDeg(GREY_DEG, 1)}`);
  if (f.earthRange[1] - f.earthRange[0] > 5) reasons.push(`Terre visible entre ${range(f.earthRange)} si l'horizon varie de ±${fmtDeg(GREY_DEG, 1)}`);
  if (f.sunFarPct >= 2) reasons.push(`${fmtPct(f.sunFarPct)} du temps, le Soleil frôle un relief à plus de ${FAR_KM} km (courbure)`);
  if (f.earthFarPct >= 2) reasons.push(`${fmtPct(f.earthFarPct)} du temps, la Terre frôle un relief à plus de ${FAR_KM} km (courbure)`);
  return (
    <div className="cards">
      <div className="card sun">
        <div className="card-k">Élévation du Soleil</div>
        <div className="card-v">{fmtDeg(n.sAlt, 2)}</div>
        <div className="card-s">
          az. {fmtDeg(n.sAz, 0)} · horizon à {fmtDeg(n.sHz, 1)}
          <br />
          {m.sunChangeH === null
            ? <b>{m.sunIsUp ? "Pas de coucher sur la période" : "Pas de lever sur la période"}</b>
            : m.sunIsUp
              ? <>Coucher dans <b>{fmtDuration(m.sunChangeH)}</b></>
              : <>Lever dans <b>{fmtDuration(m.sunChangeH)}</b></>}
          {nowWarning(f.nowSunMargin, f.nowSunFar, n.sDist)}
        </div>
      </div>
      <div className="card earth">
        <div className="card-k">Élévation de la Terre</div>
        <div className="card-v">{fmtDeg(n.eAlt, 2)}</div>
        <div className="card-s">
          az. {fmtDeg(n.eAz, 0)} · horizon à {fmtDeg(n.eHz, 1)}
          <br />
          {m.earthChangeH === null
            ? <b>{m.earthIsUp ? "Visible toute la période" : "Invisible toute la période"}</b>
            : m.earthIsUp
              ? <>Coucher de Terre dans <b>{fmtDuration(m.earthChangeH)}</b></>
              : <>Lever de Terre dans <b>{fmtDuration(m.earthChangeH)}</b></>}
          {nowWarning(f.nowEarthMargin, f.nowEarthFar, n.eDist)}
        </div>
      </div>
      <div className="card">
        <div className="card-k">Ensoleillement (période)</div>
        <div className="card-v">{fmtPct(m.sunPct)}</div>
        <div className="card-s">Plus longue nuit : <b>{fmtDuration(m.longestNightH)}</b>
          <br />Fourchette : {range(f.sunRange)}</div>
      </div>
      <div className="card">
        <div className="card-k">Terre visible (période)</div>
        <div className="card-v">{fmtPct(m.earthPct)}</div>
        <div className="card-s">Plus longue coupure : <b>{fmtDuration(m.longestNoEarthH)}</b>
          <br />Fourchette : {range(f.earthRange)}</div>
      </div>
      <div className="card both">
        <div className="card-k">Soleil + Terre</div>
        <div className="card-v">{fmtPct(m.bothPct)}</div>
        <div className="card-s">Énergie et liaison directe en même temps</div>
      </div>
      <div className="card">
        <div className="card-k">Flux solaire moyen</div>
        <div className="card-v">{fmtNum(m.meanPowerVertical)} <small>W/m²</small></div>
        <div className="card-s">Panneau vertical orientable · horizontal : {fmtNum(m.meanPowerHorizontal)} W/m²</div>
      </div>
      {relay && (
        <div className="card relay" title={`${relayName ?? "Relais"} : utilisable quand il est au-dessus du relief et à plus de ${RELAY_MIN_ELEV_DEG}° d'élévation.`}>
          <div className="card-k">Liaison Terre ou relais LRO</div>
          {relay.available ? <>
            <div className="card-v">{fmtPct(relay.linkPct)}</div>
            <div className="card-s">
              LRO : {fmtNum(relay.passesPerDay, 1)} passages/jour, {fmtPct(relay.relayPct)} du temps
              <br />Couvre {fmtPct(relay.outageCoveredPct)} des coupures Terre
              <br />Plus longue coupure totale : <b>{fmtDuration(relay.longestNoLinkH)}</b>
              <span className="muted"> (Terre seule : {fmtDuration(relay.longestNoEarthH)})</span>
            </div>
          </> : <>
            <div className="card-v">—</div>
            <div className="card-s">Orbite LRO connue du {fmtDate(relay.coveredFrom, false)} au {fmtDate(relay.coveredTo, false)} : choisissez une période dans cet intervalle.</div>
          </>}
        </div>
      )}
      <div className={`card frag ${f.level === "robuste" ? "ok" : f.level === "fragile" ? "bad" : "mid"}`}
        title={`Zone grise : Soleil à moins de ${fmtDeg(GREY_DEG, 1)} de l'horizon ${fmtPct(f.sunGreyPct)} du temps, Terre ${fmtPct(f.earthGreyPct)}.`}>
        <div className="card-k">Fiabilité du résultat</div>
        <div className="card-v">{f.level === "robuste" ? "Robuste" : f.level === "fragile" ? "Fragile" : "À confirmer"}</div>
        <div className="card-s">
          {reasons.length
            ? reasons.map((r) => <span key={r} className="frag-line">• {r}</span>)
            : `Les conclusions tiennent même si l'horizon est faux de ±${fmtDeg(GREY_DEG, 1)}.`}
        </div>
      </div>
    </div>
  );
}
