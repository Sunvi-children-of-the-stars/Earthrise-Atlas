import { useEffect, useMemo, useRef, useState } from "react";
import { fragility, metrics, seasonal, simulate } from "./astro/analysis";
import { computeMask, demElevation, flatMask, loadDem, loadMask, type Dem, type HorizonMask } from "./astro/horizon";
import { ephemerisSourceAt, loadEphemerisTable, setEphemerisTable, type EphemerisTable } from "./astro/ephemeris";
import { requestTiledHorizon } from "./astro/onDemand";
import { loadArtemisRegions, type ArtemisRegionSet } from "./astro/regions";
import { loadRelay, relayAnalysis, type RelayData } from "./astro/relay";
import { VEHICLES, type Vehicle } from "./astro/budget";
import { BudgetPanel } from "./components/BudgetPanel";
import { Comparison, type Row, type Scenario } from "./components/Comparison";
import { LandingPlanner } from "./components/LandingPlanner";
import { Optimizer } from "./components/Optimizer";
import { MetricCards } from "./components/MetricCards";
import { PoleMap } from "./components/PoleMap";
import { Seasonal } from "./components/Seasonal";
import { SiteDetails } from "./components/SiteDetails";
import { SkyPanorama } from "./components/SkyPanorama";
import { Timeline } from "./components/Timeline";
import { DURATIONS, loadSites, type SiteRecord } from "./data";
import { fmtDate, fmtNum, fromInput, toInput } from "./format";

const R_KM = 1737.4;
const siteKey = (s: SiteRecord) => (s.category === "custom" ? `custom:${s.lat.toFixed(4)},${s.lon.toFixed(4)}` : s.id);
const stepFor = (hours: number) => Math.max(10, Math.round((hours * 60) / 1500 / 5) * 5);

function makeCustom(lat: number, lon: number, dem: Dem | null): SiteRecord {
  const h = dem ? demElevation(dem, lat, lon) : NaN;
  const inDem = !Number.isNaN(h);
  return {
    id: `custom:${lat.toFixed(4)},${lon.toFixed(4)}`,
    name: "Site personnalisé", short: `Perso ${Math.abs(lat).toFixed(2)}°${lat < 0 ? "S" : "N"}`,
    category: "custom", region: "", lat, lon,
    context: inDem
      ? "Site personnalisé : altitude, pentes et horizon calculés à la demande dans le navigateur, à partir du relief LOLA multi-résolution (20 m près du site quand il existe, jusqu'à 480 m au loin)."
      : "Site personnalisé hors de l'emprise du MNT polaire (au nord de 75°S) : horizon de sol lisse, sans relief.",
    elevation_m: inDem ? Math.round(h) : null,
    dist_to_pole_km: ((90 + lat) * Math.PI / 180) * R_KM,
    in_dem: inDem,
    custom_info: { status: inDem ? "pending" : "flat" },
  };
}

function loadVehicle(): Vehicle {
  try {
    const v = JSON.parse(localStorage.getItem("lspp.vehicle") ?? "null");
    if (v && typeof v.panelM2 === "number" && typeof v.band === "string") return { ...VEHICLES.lander, ...v };
  } catch { /* storage unavailable */ }
  return VEHICLES.lander;
}

function loadScenarios(): Scenario[] {
  try { return JSON.parse(localStorage.getItem("lspp.scenarios") ?? "[]"); } catch { return []; }
}

export default function App() {
  const [sites, setSites] = useState<SiteRecord[]>([]);
  const [dem, setDem] = useState<Dem | null>(null);
  const [site, setSite] = useState<SiteRecord | null>(null);
  const [masks, setMasks] = useState<Record<string, HorizonMask>>({});
  const [start, setStart] = useState(() => Math.floor(Date.now() / 3_600_000) * 3_600_000);
  const [hours, setHours] = useState(DURATIONS[2].hours);
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [scenarios, setScenarios] = useState<Scenario[]>(loadScenarios);
  const [custom, setCustom] = useState({ lat: "-85.5", lon: "15" });
  const [error, setError] = useState<string | null>(null);
  const inflight = useRef(new Set<string>());
  const [artemis, setArtemis] = useState<ArtemisRegionSet | null>(null);
  const [relay, setRelay] = useState<RelayData | null>(null);
  // Horizons table (member 1): undefined while loading, null if absent (built-in series then)
  const [eph, setEph] = useState<EphemerisTable | null | undefined>(undefined);

  useEffect(() => {
    loadSites().then((s) => { setSites(s); setSite(s[0]); }).catch(() => setError("Impossible de charger data/sites/sites.json"));
    loadDem().then(setDem).catch(() => setError("Impossible de charger le MNT réduit"));
    loadArtemisRegions().then(setArtemis).catch(() => { /* optionnel */ });
    loadEphemerisTable().then((t) => { setEphemerisTable(t); setEph(t); });
    loadRelay().then(setRelay).catch(() => { /* optionnel : scripts/fetch_relay_ephemeris.py */ });
  }, []);

  useEffect(() => {
    try { localStorage.setItem("lspp.scenarios", JSON.stringify(scenarios)); } catch { /* storage unavailable */ }
  }, [scenarios]);
  const [vehicle, setVehicle] = useState<Vehicle>(loadVehicle);
  useEffect(() => {
    try { localStorage.setItem("lspp.vehicle", JSON.stringify(vehicle)); } catch { /* storage unavailable */ }
  }, [vehicle]);

  // Load / compute the horizon masks we need
  useEffect(() => {
    const need = [site, ...scenarios.map((s) => s.site)].filter(Boolean) as SiteRecord[];
    for (const s of need) {
      const k = siteKey(s);
      if (masks[k]) continue;
      if (s.category === "custom") {
        if (inflight.current.has(k)) continue;
        if (!s.in_dem) {
          setMasks((prev) => ({ ...prev, [k]: flatMask(s.elevation_m ?? 0) }));
          continue;
        }
        inflight.current.add(k);
        const patch = (info: SiteRecord["custom_info"], elevation?: number) =>
          setSite((prev) => (prev && siteKey(prev) === k
            ? { ...prev, custom_info: info, ...(elevation !== undefined ? { elevation_m: Math.round(elevation) } : {}) }
            : prev));
        requestTiledHorizon(s.lat, s.lon)
          .then((r) => {
            if (!r) throw new Error("hors relief");
            setMasks((prev) => ({ ...prev, [k]: r.mask }));
            patch({
              status: "tiles", site_res_m: r.site_res_m, near_res_m: r.near_res_m,
              slope_local_deg: r.slope_local_deg, slope_mean_100m_deg: r.slope_mean_100m_deg,
              slope_max_100m_deg: r.slope_max_100m_deg, tiles: r.tiles, megabytes: r.megabytes, ms: r.ms,
            }, r.elevation_m);
          })
          .catch(() => {
            // Tuiles indisponibles (ex. site déployé sans la pyramide) : MNT réduit à 1,2 km
            const m = (dem && computeMask(dem, s.lat, s.lon)) || flatMask(s.elevation_m ?? 0);
            setMasks((prev) => ({ ...prev, [k]: m }));
            patch({ status: "preview" });
          })
          .finally(() => inflight.current.delete(k));
      } else {
        loadMask(s.id).then((m) => setMasks((prev) => ({ ...prev, [k]: m })))
          .catch(() => setMasks((prev) => ({ ...prev, [k]: flatMask(s.elevation_m ?? 0) })));
      }
    }
  }, [site, scenarios, dem, masks]);

  const mask = site ? masks[siteKey(site)] : undefined;
  const samples = useMemo(
    () => (site && mask ? simulate(site, mask, start, hours, stepFor(hours)) : []),
    [site, mask, start, hours],
  );
  useEffect(() => { setCursor(0); setPlaying(false); }, [start, hours]);
  const m = useMemo(() => (samples.length ? metrics(samples, cursor) : null), [samples, cursor]);
  const frag = useMemo(() => (samples.length ? fragility(samples, cursor) : null), [samples, cursor]);
  const relayRes = useMemo(() => (site && mask && relay ? relayAnalysis(site, mask, relay, start, hours) : null),
    [site, mask, relay, start, hours]);
  const months = useMemo(() => (site && mask ? seasonal(site, mask, start) : []), [site, mask, start]);

  useEffect(() => {
    if (!playing) return;
    const n = samples.length;
    const id = setInterval(() => {
      setCursor((c) => {
        if (c >= n - 1) { setPlaying(false); return c; }
        return Math.min(n - 1, c + Math.max(1, Math.round(n / 300)));
      });
    }, 50);
    return () => clearInterval(id);
  }, [playing, samples.length]);

  const rows: Row[] = useMemo(() => scenarios.flatMap((sc) => {
    const mk = masks[siteKey(sc.site)];
    if (!mk) return [];
    const ss = simulate(sc.site, mk, sc.start, sc.hours, stepFor(sc.hours));
    return [{ sc, m: metrics(ss), f: fragility(ss), relay: relay ? relayAnalysis(sc.site, mk, relay, sc.start, sc.hours) : null }];
  }), [scenarios, masks, relay]);

  const addScenario = (list: SiteRecord[]) => {
    setScenarios((prev) => {
      const next = [...prev];
      for (const s of list) {
        const key = `${siteKey(s)}@${start}@${hours}`;
        if (!next.some((x) => x.key === key)) next.push({ key, site: s, start, hours });
      }
      return next;
    });
  };

  const pickCustom = (lat: number, lon: number) => {
    const s = makeCustom(lat, lon, dem);
    setSite(s);
    setCustom({ lat: lat.toFixed(4), lon: lon.toFixed(4) });
  };

  if (error) return <div className="fatal">{error}. Lancez <code>npm run sync-data</code>.</div>;
  if (!site || eph === undefined) return <div className="fatal">Chargement…</div>;

  const ephHorizons = ephemerisSourceAt(start) === "horizons" && ephemerisSourceAt(start + hours * 3_600_000) === "horizons";

  const mapSites = site.category === "custom" ? [...sites, site] : sites;
  const groups: [string, SiteRecord[]][] = [
    ["Sites candidats", sites.filter((s) => s.category === "candidat")],
    ["Sites de référence", sites.filter((s) => s.category === "reference")],
  ];

  return (
    <div className="app">
      <header>
        <div>
          <h1>Lunar South Pole Planner</h1>
          <p className="sub">Soleil et Terre au-dessus de l'horizon : énergie et communication directe, site par site, date par date.</p>
        </div>
        {ephHorizons
          ? <span className="badge" title="Table JPL Horizons (DE440) du Soleil et de la Terre vus du centre de la Lune, au pas d'une heure. Écart avec Horizons en mode observateur : ≤ 0,003° sur 2026–2028.">
              Éphémérides : JPL Horizons (DE440)
            </span>
          : <span className="badge warn" title={`Hors de la table Horizons${eph ? ` (${fmtDate(eph.startUtcMs, false)} – ${fmtDate(eph.endUtcMs, false)})` : ""} : séries intégrées, écart max 0,005° (Soleil) et 0,19° (Terre), heures de lever/coucher de Terre décalées de 1 h en moyenne, 2,5 h au plus.`}>
              Éphémérides : modèle intégré (hors table Horizons)
            </span>}
      </header>

      <aside>
        {groups.map(([label, list]) => (
          <section key={label}>
            <h3>{label}</h3>
            <div className="site-list">
              {list.map((s) => (
                <button key={s.id} className={s.id === site.id ? "site on" : "site"} onClick={() => setSite(s)}>
                  <span className={`dot ${s.category}`} />
                  <span className="site-name">{s.short}</span>
                  <span className="site-meta">{Math.abs(s.lat).toFixed(1)}°{s.lat < 0 ? "S" : "N"}</span>
                </button>
              ))}
            </div>
          </section>
        ))}
        <section>
          <h3>Coordonnées personnalisées</h3>
          <form className="custom" onSubmit={(e) => {
            e.preventDefault();
            const lat = parseFloat(custom.lat.replace(",", ".")), lon = parseFloat(custom.lon.replace(",", "."));
            if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180) pickCustom(lat, lon);
          }}>
            <label>Lat.<input value={custom.lat} onChange={(e) => setCustom({ ...custom, lat: e.target.value })} inputMode="decimal" /></label>
            <label>Lon. E<input value={custom.lon} onChange={(e) => setCustom({ ...custom, lon: e.target.value })} inputMode="decimal" /></label>
            <button type="submit">Analyser</button>
          </form>
          <p className="hint">Astuce : cliquez sur la carte pour choisir un point.</p>
        </section>
        {dem && (
          <section>
            <h3>Carte du pôle Sud (LOLA)</h3>
            <PoleMap dem={dem} sites={mapSites} selected={site} onPick={pickCustom}
              onSelect={(id) => { const s = sites.find((x) => x.id === id); if (s) setSite(s); }} regions={artemis} />
          </section>
        )}
      </aside>

      <main>
        <section className="panel controls">
          <div className="title-row">
            <h2>{site.name}</h2>
            <span className="region">{site.region}</span>
          </div>
          <div className="ctrl-row">
            <label>Date de début (UTC)
              <input type="datetime-local" value={toInput(start)}
                onChange={(e) => { const t = fromInput(e.target.value); if (!Number.isNaN(t)) setStart(t); }} />
            </label>
            <label>Période analysée
              <select value={hours} onChange={(e) => setHours(Number(e.target.value))}>
                {DURATIONS.map((d) => <option key={d.hours} value={d.hours}>{d.label}</option>)}
                {!DURATIONS.some((d) => d.hours === hours) && <option value={hours}>{fmtNum(hours / 24, 1)} jours</option>}
              </select>
            </label>
            <div className="btns">
              <button onClick={() => setStart(start - hours * 3_600_000)} title="Période précédente">◀</button>
              <button onClick={() => setStart(start + hours * 3_600_000)} title="Période suivante">▶</button>
              <button className="primary" onClick={() => addScenario([site])}>+ Ajouter au comparatif</button>
              <button onClick={() => addScenario(sites.filter((s) => s.category === "candidat"))}>
                Comparer les candidats
              </button>
            </div>
          </div>
          {samples.length > 0 && (
            <div className="scrub">
              <button className="play" onClick={() => {
                if (cursor >= samples.length - 1) setCursor(0);
                setPlaying(!playing);
              }} aria-label={playing ? "Pause" : "Lecture"}>{playing ? "❚❚" : "▶"}</button>
              <input type="range" min={0} max={samples.length - 1} value={cursor}
                onChange={(e) => { setPlaying(false); setCursor(Number(e.target.value)); }} />
              <span className="now">{fmtDate(samples[cursor].t)}</span>
            </div>
          )}
        </section>

        {m && frag && mask ? (
          <>
            <MetricCards m={m} f={frag} relay={relayRes} relayName={relay?.meta.satellite} />
            <section className="panel">
              <h3>Bilan énergie et télécom <span className="muted">— un véhicule de référence sur ce site et cette période : batterie, panneaux, débit vers la Terre</span></h3>
              <BudgetPanel samples={samples} vehicle={vehicle} onVehicle={setVehicle} />
            </section>
            <section className="panel">
              <h3>Vue du ciel depuis le site <span className="muted">— horizon réel (gris), trajectoires sur la période</span></h3>
              <SkyPanorama samples={samples} cursor={cursor} mask={mask} />
              <div className="legend">
                <span><i className="sw sun" />Soleil visible</span>
                <span><i className="sw sun dim" />Soleil caché</span>
                <span><i className="sw earth" />Terre visible</span>
                <span><i className="sw earth dim" />Terre cachée</span>
                <span className="muted">Vue depuis la Lune, la Terre (1,9°) paraît 3,6 fois plus grande que le Soleil (0,53°).</span>
              </div>
            </section>
            <section className="panel">
              <h3>Chronologie <span className="muted">— élévation (traits pleins), horizon dans leur direction (pointillés). Bande ⚠ : moments incertains (astre à moins de 0,5° de l'horizon, ou relief à plus de 100 km qui décide). Cliquer pour déplacer le curseur.</span></h3>
              <Timeline samples={samples} m={m} fragile={frag} relay={relayRes} cursor={cursor} onCursor={(i) => { setPlaying(false); setCursor(i); }} />
            </section>
            <div className="two">
              <section className="panel seasonal">
                <h3>Au fil des mois lunaires <span className="muted">— cliquer un mois pour l'analyser</span></h3>
                <Seasonal stats={months} current={start} onPick={(t) => { setStart(t); setHours(DURATIONS[2].hours); }} />
                <div className="legend">
                  <span><i className="sw sun" />Soleil (%)</span>
                  <span><i className="sw earth" />Terre (%)</span>
                  <span className="muted">Sous chaque mois : plus longue nuit</span>
                </div>
              </section>
              <section className="panel">
                <h3>Terrain du site</h3>
                <SiteDetails site={site} mask={mask} artemis={artemis} />
              </section>
            </div>
          </>
        ) : (
          <div className="panel loading">
            {site.category === "custom"
              ? "Calcul de l'horizon à partir du relief LOLA (chargement des tuiles 20 m → 480 m)…"
              : "Chargement de l'horizon…"}
          </div>
        )}

        <section className="panel">
          <h3>Choisir la date d'atterrissage <span className="muted">— aide à la décision : chaque date possible notée sur les sites candidats</span></h3>
          <LandingPlanner sites={sites} vehicle={vehicle} defaultFrom={start}
            onAnalyze={(s, t, h) => { setSite(s); setStart(t); setHours(h); window.scrollTo({ top: 0, behavior: "smooth" }); }} />
        </section>

        <section className="panel">
          <h3>Recherche de zones optimales <span className="muted">— sur la période choisie, selon le profil de mission</span></h3>
          <Optimizer start={start} hours={hours} sites={sites} artemis={artemis} relay={relay}
            onAnalyze={(lat, lon) => { pickCustom(lat, lon); window.scrollTo({ top: 0, behavior: "smooth" }); }} />
        </section>

        <section className="panel">
          <div className="title-row">
            <h3>Comparatif des scénarios</h3>
            {scenarios.length > 0 && <button className="link" onClick={() => setScenarios([])}>Tout effacer</button>}
          </div>
          <Comparison rows={rows} onRemove={(k) => setScenarios(scenarios.filter((s) => s.key !== k))}
            onOpen={(sc) => { setSite(sc.site); setStart(sc.start); setHours(sc.hours); }} />
          <p className="hint">En vert : meilleure valeur de chaque colonne.</p>
        </section>

        <footer>
          Relief : NASA LRO / LOLA (LDEM_85S_20M, LDEM_75S_120M). Éphémérides : table JPL Horizons
          (DE440, 2026–2030, membre 1) et modèle d'orientation IAU ; séries de l'Astronomical Almanac en
          dehors de cette période. Le Soleil est
          compté visible quand plus de la moitié de son disque dépasse l'horizon ; la Terre, quand son
          centre le dépasse. Toutes les heures sont en UTC.
        </footer>
      </main>
    </div>
  );
}
