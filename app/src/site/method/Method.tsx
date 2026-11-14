// TEMPORARY visual check of the charts (Task 3); replaced by the real Method page in Task 8.
import { useMemo, useState } from "react";
import { simulate } from "../../astro/analysis";
import { useData, useMask } from "../data/store";
import { siteText } from "../i18n/sites";
import { useI18n } from "../i18n";
import { PolarMap } from "../viz/PolarMap";
import { Silhouette } from "../viz/Silhouette";
import { SkyChart } from "../viz/SkyChart";
import { TimelineChart } from "../viz/TimelineChart";

export function Method() {
  const { sites, artemis, ephReady } = useData();
  const { lang } = useI18n();
  const ridge = sites.find((s) => s.id === "connecting-ridge") ?? null;
  const { mask } = useMask(ridge);
  const [cursor, setCursor] = useState(200);
  const [picked, setPicked] = useState("");
  const samples = useMemo(() => (ridge && mask && ephReady ? simulate(ridge, mask, Date.UTC(2026, 10, 14, 16), 708.7, 30) : []),
    [ridge, mask, ephReady]);
  return (
    <section className="page container stack">
      <div className="page-head"><h1>Charts preview</h1><p>{picked}</p></div>
      {mask && <Silhouette mask={mask} />}
      {samples.length > 0 && mask && <SkyChart samples={samples} cursor={cursor} mask={mask} />}
      {samples.length > 0 && <TimelineChart samples={samples} cursor={cursor} onCursor={setCursor} />}
      <PolarMap sites={sites.filter((s) => s.lat <= -75)} selectedId="connecting-ridge" artemis={artemis}
        labelOf={(s) => siteText(s, lang).short} onSelectSite={(id) => setPicked(id)}
        onPickPoint={(lat, lon) => setPicked(`${lat.toFixed(3)}, ${lon.toFixed(3)}`)} />
    </section>
  );
}
